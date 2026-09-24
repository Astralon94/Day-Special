import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'day-special-domain-'));
cpSync(new URL('../server/', import.meta.url), join(dir, 'server'), { recursive: true });
mkdirSync(join(dir, 'src/shared'), { recursive: true });
copyFileSync(
  new URL('../src/shared/docKeys.js', import.meta.url),
  join(dir, 'src/shared/docKeys.js'),
);
copyFileSync(new URL('../package.json', import.meta.url), join(dir, 'package.json'));
process.env.DS_DB = ':memory:';
const { execute, state } = await import(pathToFileURL(join(dir, 'server/domain/service.js')));
const { db } = await import(pathToFileURL(join(dir, 'server/db.js')));
let counter = 0;
const revisions = () =>
  Object.fromEntries(Object.entries(state().documents).map(([k, d]) => [k, d.rev]));
const payload = (operation, input, expected = revisions()) => ({
  id: 'request_' + ++counter,
  operation,
  input,
  expected,
});
const command = (operation, input = {}) => execute(payload(operation, input));
const values = (key) => state().documents[key].value;
beforeEach(() => db.exec('DELETE FROM documents; DELETE FROM command_receipts;'));
after(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
test('lettura senza scritture o importazione browser, default deterministici', () => {
  const a = state();
  assert.deepEqual(a, state());
  assert.equal(db.prepare('SELECT count(*) AS n FROM documents').get().n, 0);
  assert.equal(a.documents.ds_checklist.value.items.length > 0, true);
});
test('operazioni CRUD per ogni sezione, valori validati e rollback', () => {
  for (const [kind, values] of Object.entries({
    budget: { descrizione: 'Spesa', preventivo: 25 },
    supplier: { nome: 'Fornitore' },
    event: { titolo: 'Cerimonia', ora: '12:00' },
    task: { titolo: 'Prova' },
    table: { posti: 4 },
  })) {
    const result = command(kind + '.save', { values });
    assert.ok(result.result.id);
    command(kind + '.delete', { id: result.result.id });
  }
  const before = state();
  assert.throws(
    () => command('budget.save', { values: { descrizione: 'Errata', preventivo: -1 } }),
    /intervallo/,
  );
  assert.deepEqual(state(), before);
  assert.throws(
    () => command('event.save', { values: { titolo: 'Ora errata', ora: '25:00' } }),
    /Orario/,
  );
  assert.throws(
    () => command('task.save', { values: { titolo: 'Data errata', scadenza: '2026-02-31' } }),
    /Data/,
  );
  assert.throws(() => command('table.save', { values: { guestIds: ['x'] } }), /Campo/);
});
test('concorrenza: nessuna sovrascrittura e ricevuta idempotente anche dopo altre modifiche', () => {
  const initial = revisions(),
    a = payload('budget.total', { value: 100 }, initial),
    b = payload('budget.total', { value: 200 }, initial);
  execute(a);
  assert.throws(
    () => execute(b),
    (e) => e.status === 409,
  );
  command('budget.total', { value: 300 });
  const replay = execute(a);
  assert.equal(replay.replayed, true);
  assert.equal(values('ds_budget').totale, 300);
  assert.throws(
    () => execute({ ...a, input: { value: 400 } }),
    (e) => e.status === 409,
  );
});
test('tavoli: assegnazione esclusiva, capienza e transazioni fra invitati e sala', () => {
  const g = command('group.create', {
    section: 'sposo',
    values: { name: 'Famiglia', type: 'famiglia' },
  }).result.id;
  const a = command('guest.create', { group_id: g, values: { name: 'Uno', status: 'confermato' } })
    .result.id;
  const b = command('guest.create', { group_id: g, values: { name: 'Due', status: 'confermato' } })
    .result.id;
  const t1 = command('table.save', { values: { posti: 1 } }).result.id,
    t2 = command('table.save', { values: { posti: 1 } }).result.id;
  command('table.assign', { id: t1, guest_id: a });
  assert.throws(() => command('table.assign', { id: t1, guest_id: b }), /Capienza/);
  assert.deepEqual(values('ds_tavoli').tavoli[0].guestIds, [a]);
  command('table.assign', { id: t2, guest_id: a });
  assert.deepEqual(values('ds_tavoli').tavoli[0].guestIds, []);
  command('group.contact', { id: g, guest_id: a });
  command('guest.delete', { group_id: g, id: a });
  assert.deepEqual(values('ds_tavoli').tavoli[1].guestIds, []);
  assert.equal(values('ds_invitati').sposo.groups[0].capofamiglia, null);
});
test('regole invitati, trasferimento e catering calcolati sul server', () => {
  const a = command('group.create', { section: 'sposo', values: { name: 'A', type: 'famiglia' } })
    .result.id;
  const b = command('group.create', { section: 'sposa', values: { name: 'B' } }).result.id;
  const g = command('guest.create', { group_id: a, values: { name: 'Invitato', formale: true } })
    .result.id;
  command('group.contact', { id: a, guest_id: g });
  command('guest.patch', { id: g, values: { status: 'confermato' } });
  assert.equal(values('ds_invitati').sposo.groups[0].guests[0].formale, false);
  assert.throws(() => command('guest.patch', { id: g, values: { formale: true } }), /formale/);
  command('guest.transfer', { id: g, from_group: a, to_group: b });
  assert.equal(values('ds_invitati').sposo.groups[0].capofamiglia, null);
  command('prices.set', { values: { adulto: 85 } });
  command('budget.catering');
  assert.equal(values('ds_budget').voci[0].preventivo, 85);
  command('budget.catering');
  assert.equal(values('ds_budget').voci.length, 1);
});
test('template, ordine e versioni obsolete dei moduli', () => {
  const before = values('ds_checklist').items.length;
  command('task.template');
  assert.equal(values('ds_checklist').items.length, before);
  const one = command('event.save', { values: { titolo: 'Tardi', ora: '18:00' } }).result.id;
  const two = command('event.save', { values: { titolo: 'Presto', ora: '10:00' } }).result.id;
  const stale = revisions();
  command('event.sort');
  assert.deepEqual(values('ds_programma').eventOrder, [two, one]);
  assert.throws(
    () => execute(payload('event.save', { id: one, values: { titolo: 'Vecchio' } }, stale)),
    (e) => e.status === 409,
  );
  assert.throws(
    () => command('event.order', { ids: [one, one] }),
    (e) => e.status === 409,
  );
});
test('documenti storici conservati, normalizzazione non distruttiva', () => {
  const legacy = {
    sposo: { groups: [], groupOrder: [] },
    sposa: { groups: [], groupOrder: [] },
    comuni: { groups: [], groupOrder: [] },
    extra: 'conservato',
  };
  db.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(
    'ds_invitati',
    JSON.stringify(legacy),
    'prima',
    4,
  );
  assert.equal(values('ds_invitati').extra, 'conservato');
  command('group.create', { section: 'comuni', values: { name: 'Nuovo' } });
  assert.equal(values('ds_invitati').extra, 'conservato');
  assert.equal(state().documents.ds_invitati.rev, 5);
});
