import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const key = 'ds_budget';
const snapshot = (total = 0, rev = 1) => ({
  protocol: 2,
  documents: { [key]: { value: { totale: total, voci: [] }, rev } },
  computed: { cateringCost: 0 },
});
function client(cached = null) {
  const data = new Map(cached ? [['ds_server_cache_v2', JSON.stringify(cached)]] : []),
    events = [],
    requests = [],
    timers = new Map();
  let seq = 0;
  data.set('ds_budget', '{"totale":9999}');
  data.set('ds_base', '{"originale":true}');
  const c = vm.createContext({
    DOC_KEYS: [key],
    App: { toast() {} },
    console,
    location: { hash: '#/budget' },
    navigator: { onLine: true },
    crypto: { randomUUID: () => `request_${++seq}` },
    AbortController,
    localStorage: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) },
    window: { dispatchEvent: (e) => events.push(e) },
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
    setTimeout: (fn, ms) => {
      timers.set(++seq, { fn, ms });
      return seq;
    },
    clearTimeout: (i) => timers.delete(i),
    fetch: (url, options) =>
      new Promise((resolve, reject) => {
        requests.push({ url, options, resolve, reject });
        options.signal.addEventListener('abort', () => reject(new Error('timeout')));
      }),
  });
  vm.runInContext(
    readFileSync(new URL('../src/state/storage.js', import.meta.url), 'utf8')
      .replace(/^import .*;$/gm, '')
      .replace('export const DS', 'const DS'),
    c,
  );
  const tick = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };
  const reply = async (index, body, status = 200) => {
    assert.ok(requests[index], `richiesta ${index}`);
    requests[index].resolve({ ok: status >= 200 && status < 300, status, json: async () => body });
    await tick();
  };
  const connect = async () => {
    const p = c.window.DS.refresh();
    await reply(requests.length - 1, snapshot());
    await p;
  };
  return { DS: c.window.DS, c, data, requests, events, timers, reply, connect, tick };
}
test('il bootstrap non usa o importa documenti legacy e offline rifiuta le modifiche', async () => {
  const a = client();
  assert.equal(a.DS.get(key), null);
  assert.equal(await a.DS.command('budget.total', { value: 10 }), null);
  assert.equal(a.requests.length, 0);
  await a.connect();
  assert.equal(a.DS.get(key).totale, 0);
  assert.equal(a.data.get('ds_budget'), '{"totale":9999}');
  assert.equal(a.data.get('ds_base'), '{"originale":true}');
});
test('cache confermata consultabile offline, quota piena non compromette lo snapshot', async () => {
  const a = client(snapshot(20));
  assert.equal(a.DS.get(key).totale, 20);
  assert.equal(a.DS.writable, false);
  a.c.localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  await a.connect();
  assert.equal(a.DS.writable, true);
  assert.equal(a.DS.get(key).totale, 0);
});
test('salvato solo dopo commit, una richiesta alla volta e viste notificate', async () => {
  const a = client();
  await a.connect();
  const saving = a.DS.command('budget.total', { value: 20 });
  assert.equal(a.DS.status, 'saving');
  assert.equal(a.DS.get(key).totale, 0);
  assert.equal(await a.DS.command('budget.total', { value: 30 }), null);
  await a.reply(1, { result: {}, state: snapshot(20, 2) });
  await a.reply(2, snapshot(20, 2));
  await saving;
  assert.equal(a.DS.status, 'synced');
  assert.equal(a.DS.get(key).totale, 20);
  assert.ok(a.events.some((e) => e.type === 'ds:change' && e.detail.remote));
});
test('risposta persa: stesso ID e payload, niente nuove modifiche fino alla ricevuta', async () => {
  const a = client();
  await a.connect();
  const saving = a.DS.command('budget.total', { value: 20 });
  a.requests[1].reject(new Error('Risposta persa'));
  await saving;
  assert.equal(a.DS.status, 'uncertain');
  assert.equal(await a.DS.command('budget.total', { value: 30 }), null);
  const recovering = a.DS.recover();
  assert.equal(a.requests[2].options.body, a.requests[1].options.body);
  await a.reply(2, { result: {}, state: snapshot(20, 2), replayed: true });
  await a.reply(3, snapshot(20, 2));
  await recovering;
  assert.equal(a.DS.status, 'synced');
});
test('timeout della richiesta libera il client e consente recupero idempotente', async () => {
  const a = client();
  await a.connect();
  const saving = a.DS.command('budget.total', { value: 20 });
  for (const { fn } of [...a.timers.values()]) fn();
  await saving;
  assert.equal(a.DS.status, 'uncertain');
  const recovery = a.DS.recover();
  await a.reply(2, { result: {}, state: snapshot(20, 2) });
  await a.reply(3, snapshot(20, 2));
  await recovery;
  assert.equal(a.DS.writable, true);
});
test('conflitto non ripetuto automaticamente e stato aggiornato dal server', async () => {
  const a = client();
  await a.connect();
  const saving = a.DS.command('budget.total', { value: 20 });
  await a.reply(1, { error: 'Conflitto' }, 409);
  await a.reply(2, snapshot(40, 2));
  await saving;
  assert.equal(a.DS.get(key).totale, 40);
  assert.equal(a.requests.filter((x) => x.options.method === 'POST').length, 1);
});
test('GET precedente al comando non fa regredire la conferma', async () => {
  const a = client();
  await a.connect();
  const old = a.DS.refresh();
  const saving = a.DS.command('budget.total', { value: 20 });
  await a.reply(2, { result: {}, state: snapshot(20, 2) });
  await a.reply(1, snapshot(0, 1));
  await old;
  await a.reply(3, snapshot(20, 2));
  await saving;
  assert.equal(a.DS.get(key).totale, 20);
});

test('snapshot con errore isolato resta leggibile e segnala la sezione indisponibile', async () => {
  const a = client();
  const p = a.DS.refresh();
  const s = snapshot(); s.documents[key] = { value: null, rev: 2, error: 'Dati da verificare' };
  await a.reply(0, s); await p;
  assert.equal(a.DS.ready, true);
  assert.equal(a.DS.get(key), null);
  assert.equal(a.DS.documentError(key), 'Dati da verificare');
  assert.equal(a.DS.status, 'synced');
});

test('lettura finale lenta: nessun secondo inserimento prima del ritorno alla vista', async () => {
  const a = client(); await a.connect();
  let completed = false;
  const first = a.DS.command('guest.create', { values: { name: 'Prova' } }).then(() => { completed = true; });
  await a.reply(1, { result: { id: 'guest-1' }, state: snapshot(20, 2) });
  assert.equal(completed, false);
  assert.equal(a.DS.writable, false);
  assert.equal(a.DS.status, 'saving');
  assert.equal(await a.DS.command('guest.create', { values: { name: 'Prova' } }), null);
  assert.equal(a.requests.filter(r => r.options.method === 'POST').length, 1);
  await a.reply(2, snapshot(20, 2)); await first;
  assert.equal(completed, true); assert.equal(a.DS.writable, true);
});
