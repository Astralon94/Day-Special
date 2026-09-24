// Un solo ingresso per le modifiche: validazione, concorrenza, ricevuta e commit.
import { createHash } from 'node:crypto';
import { db, backupDb } from '../db.js';
import { commands } from './commands.js';
import { DOC_KEYS, normalize, object, id, fail, cateringCost } from './model.js';
db.exec(`CREATE TABLE IF NOT EXISTS command_receipts (
  id TEXT PRIMARY KEY, digest TEXT NOT NULL, operation TEXT NOT NULL,
  result TEXT NOT NULL, created_at TEXT NOT NULL
)`);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical(value[k])]),
    );
  return value;
}
function readState() {
  const saved = new Map(db.prepare('SELECT * FROM documents').all().map(row => [row.key, row]));
  const documents = {}, values = {};
  for (const key of DOC_KEYS) {
    const row = saved.get(key);
    const entry = { value: null, rev: row?.rev || 0, updated_at: row?.updated_at || null };
    try {
      entry.value = normalize(key, row ? JSON.parse(row.value) : undefined);
    } catch {
      // Conserva il documento originale: solo le operazioni che lo usano sono bloccate.
      entry.error = 'Dati della sezione non validi: verifica necessaria prima di modificarli.';
    }
    documents[key] = entry;
    values[key] = entry.value;
  }
  const computed = { cateringCost: null };
  if (values.ds_invitati && values.ds_prices) computed.cateringCost = cateringCost(values);
  return { protocol: 2, documents, computed };
}
export function state() {
  db.exec('BEGIN');
  try {
    const result = readState();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function execute(command) {
  object(command);
  id(command.id);
  object(command.input);
  object(command.expected);
  const definition = Object.hasOwn(commands, command.operation)
    ? commands[command.operation]
    : null;
  if (!definition) fail('Operazione non disponibile', 404);
  const digest = createHash('sha256')
    .update(JSON.stringify(canonical(command)))
    .digest('hex');
  db.exec('BEGIN IMMEDIATE');
  let response;
  try {
    const receipt = db
      .prepare('SELECT digest,result FROM command_receipts WHERE id=?')
      .get(command.id);
    if (receipt) {
      if (receipt.digest !== digest)
        fail('Identificativo richiesta già usato per un altro comando', 409);
      response = { ...JSON.parse(receipt.result), state: readState(), replayed: true };
    } else {
      const before = readState();
      for (const key of definition.keys) {
        if (before.documents[key].error) fail(before.documents[key].error, 422);
        if (!Number.isSafeInteger(command.expected[key]) || command.expected[key] < 0)
          fail('Revisione richiesta per ' + key, 428);
        if (command.expected[key] !== before.documents[key].rev)
          fail('Dati modificati da un altro dispositivo. Verifica i dati aggiornati; se stai compilando un modulo, riaprilo prima di riprovare.', 409);
      }
      const values = Object.fromEntries(
        DOC_KEYS.map((k) => [k, structuredClone(before.documents[k].value)]),
      );
      const result = definition.run(values, command.input) || {};
      const changed = [];
      for (const key of DOC_KEYS) {
        if (JSON.stringify(values[key]) === JSON.stringify(before.documents[key].value)) continue;
        if (!definition.keys.includes(key)) throw new Error('Scrittura fuori dal contratto');
        const serialized = JSON.stringify(values[key]);
        if (Buffer.byteLength(serialized) > 2 * 1024 * 1024) fail('Documento troppo grande', 413);
        db.prepare(
          `INSERT INTO documents(key,value,updated_at,rev) VALUES(?,?,?,1)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,rev=documents.rev+1`,
        ).run(key, serialized, new Date().toISOString());
        changed.push(key);
      }
      const receiptResult = { result, changed };
      db.prepare('INSERT INTO command_receipts VALUES(?,?,?,?,?)').run(
        command.id,
        digest,
        command.operation,
        JSON.stringify(receiptResult),
        new Date().toISOString(),
      );
      response = { ...receiptResult, state: readState(), replayed: false };
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  if (!response.replayed && response.changed.length) backupDb();
  return response;
}
