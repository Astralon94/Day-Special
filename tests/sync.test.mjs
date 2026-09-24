import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const key = 'ds_checklist';
const value = (...ids) => ({ items: ids.map(id => ({ id })) });
const plain = x => JSON.parse(JSON.stringify(x));

// Esegue i moduli reali con browser/rete/orologio controllati. Le sole funzioni
// private esposte servono a riprodurre interleaving senza attese temporali fragili.
function client(initial = value(), rev = 1) {
  const data = new Map(), listeners = {}, timers = new Map(), requests = [];
  let serial = 0;
  const c = vm.createContext({
    console: { warn() {} }, DOC_KEYS: [key], App: { toast() {} },
    localStorage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) },
    window: { addEventListener: (k, f) => (listeners[k] ??= []).push(f), dispatchEvent: e => (listeners[e.type] || []).forEach(f => f(e)) },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document: { getElementById: () => null }, navigator: { onLine: true },
    setTimeout: (fn, ms) => { timers.set(++serial, { fn, ms }); return serial; }, clearTimeout: id => timers.delete(id),
    fetch: (url, opts) => new Promise((resolve, reject) => requests.push({ url, opts, resolve, reject })),
    EventSource: class { constructor() { c.stream = this; } addEventListener() {} close() {} },
  });
  for (const name of ['storage', 'sync']) {
    let source = readFileSync(new URL('../src/state/' + name + '.js', import.meta.url), 'utf8')
      .replace(/^import .*;$/mg, '').replace('export const ', 'const ');
    if (name === 'sync') source = source.replace('return { init, onViewMounted,', 'return { pushKey, reconcileRemote, startSync, queuePush, init, onViewMounted,');
    vm.runInContext(source, c);
  }
  const DS = c.window.DS, S = c.window.Sync;
  DS.set(key, initial); DS.setBase(key, initial); DS.setRev(key, rev);
  c.window.addEventListener('ds:change', e => { if (!e.detail.remote) S.queuePush(e.detail.key); });
  const reply = async (index, body, status = 200) => {
    assert.ok(requests[index], 'Richiesta attesa ' + index);
    requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    // Scarica le continuazioni async (fetch, json e finally).
    for (let i = 0; i < 12; i++) await Promise.resolve();
  };
  return { c, DS, S, requests, timers, reply };
}

test('retry offline: conserva le aggiunte remote prima della PUT', async () => {
  const a = client(); a.DS.set(key, value('locale'));
  const first = a.S.pushKey(key); a.requests[0].reject(new Error('offline')); await first;
  const retry = a.S.pushKey(key);
  await a.reply(1, { value: value('remoto'), rev: 2 });
  const sent = JSON.parse(a.requests[2].opts.body);
  assert.equal(sent.expected_rev, 2);
  assert.deepEqual(sent.value.items.map(x => x.id).sort(), ['locale', 'remoto']);
  await a.reply(2, { rev: 3 }); await retry;
  assert.equal(a.S.pending, 0);
});

test('una sola PUT in volo e nuova modifica conservata fino alla conferma', async () => {
  const a = client(); a.DS.set(key, value('a'));
  const first = a.S.pushKey(key); await a.reply(0, { value: value(), rev: 1 });
  a.DS.set(key, value('a', 'b')); await a.S.pushKey(key);
  assert.equal(a.requests.length, 2);
  await a.reply(1, { rev: 2 }); await first;
  assert.equal(a.S.pending, 1); assert.equal(a.S.status, 'syncing');
  const next = a.S.pushKey(key); await a.reply(2, { value: value('a'), rev: 2 });
  assert.deepEqual(JSON.parse(a.requests[3].opts.body).value, value('a', 'b'));
  await a.reply(3, { rev: 3 }); await next;
  assert.equal(a.S.pending, 0); assert.equal(a.S.status, 'synced');
});

test('conflitto 409 riconciliato e ritentato senza sovrascrivere il remoto', async () => {
  const a = client(); a.DS.set(key, value('a'));
  const first = a.S.pushKey(key); await a.reply(0, { value: value(), rev: 1 });
  await a.reply(1, { current: { value: value('b'), rev: 2 } }, 409); await first;
  assert.equal(a.S.pending, 1);
  const retry = a.S.pushKey(key); await a.reply(2, { value: value('b'), rev: 2 });
  assert.deepEqual(JSON.parse(a.requests[3].opts.body).value.items.map(x => x.id).sort(), ['a', 'b']);
  await a.reply(3, { rev: 3 }); await retry;
  assert.equal(a.S.pending, 0);
});

test('snapshot superati non fanno regredire contenuto, base e revisione', () => {
  const a = client(value('a'), 3);
  a.S.reconcileRemote(key, value(), 2);
  assert.deepEqual(plain(a.DS.get(key)), value('a'));
  assert.deepEqual(plain(a.DS.getBase(key)), value('a'));
  assert.equal(a.DS.getRev(key), 3);
});

test('SSE durante una PUT viene applicato dopo la risposta senza regressione', async () => {
  const a = client(); a.DS.set(key, value('a'));
  const first = a.S.pushKey(key); await a.reply(0, { value: value(), rev: 1 });
  a.S.reconcileRemote(key, value('a', 'b'), 3);
  await a.reply(1, { rev: 2 }); await first;
  assert.deepEqual(plain(a.DS.get(key)), value('a', 'b'));
  assert.equal(a.DS.getRev(key), 3);
});

test('la prima apertura SSE recupera le modifiche successive al pull', async () => {
  const a = client(); const starting = a.S.startSync();
  await a.reply(0, { [key]: { value: value(), rev: 1 } }); await starting;
  a.c.stream.onopen();
  assert.equal(a.requests.length, 2);
  await a.reply(1, { [key]: { value: value('intervallo'), rev: 2 } });
  assert.deepEqual(plain(a.DS.get(key)), value('intervallo'));
});

test('risposta PUT persa: il retry riconosce il documento già salvato', async () => {
  const a = client(); a.DS.set(key, value('a'));
  const first = a.S.pushKey(key); await a.reply(0, { value: value(), rev: 1 });
  a.requests[1].reject(new Error('Risposta persa dopo il commit')); await first;
  const retry = a.S.pushKey(key); await a.reply(2, { value: value('a'), rev: 2 }); await retry;
  assert.equal(a.requests.length, 3); // Nessuna seconda PUT necessaria.
  assert.equal(a.S.pending, 0); assert.equal(a.S.status, 'synced');
});

test('la base remota avanza anche con modifiche locali ancora da salvare', () => {
  const a = client(); a.DS.set(key, value('locale'));
  a.S.reconcileRemote(key, value('remoto'), 2);
  a.S.reconcileRemote(key, value(), 3); // L'altro dispositivo cancella la sua aggiunta.
  assert.deepEqual(plain(a.DS.get(key)), value('locale'));
  assert.deepEqual(plain(a.DS.getBase(key)), value());
  assert.equal(a.S.pending, 1);
});
