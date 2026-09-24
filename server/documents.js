// ============ Documenti key-value: get/put/counts ============
import { db, backupDb } from './db.js';
import { DOC_KEYS } from '../src/shared/docKeys.js';

// Tutti i documenti presenti (una chiave assente = "mai salvata", comportamento
// identico a una localStorage vuota: non viene seminato alcun default).
export function getAll() {
  const out = {};
  for (const row of db.prepare('SELECT key, value, updated_at, rev FROM documents').all()) {
    if (!DOC_KEYS.includes(row.key)) continue;
    out[row.key] = { value: JSON.parse(row.value), updated_at: row.updated_at, rev: row.rev };
  }
  return out;
}

export function get(key) {
  if (!DOC_KEYS.includes(key)) return null;
  const row = db.prepare('SELECT value, updated_at, rev FROM documents WHERE key = ?').get(key);
  if (!row) return null;
  return { value: JSON.parse(row.value), updated_at: row.updated_at, rev: row.rev };
}

// Controllo revisione e scrittura nella stessa transazione: nessun client
// può sostituire uno snapshot che nel frattempo è stato aggiornato.
export function put(key, value, expectedRev) {
  if (!DOC_KEYS.includes(key)) throw new Error('Chiave non valida: ' + key);
  if (value === null || typeof value !== 'object') throw new Error('Valore non valido per ' + key);
  if (!Number.isSafeInteger(expectedRev) || expectedRev < 0) {
    throw Object.assign(new Error('Revisione attesa obbligatoria: aggiorna la pagina'), { status: 428 });
  }
  db.exec('BEGIN IMMEDIATE');
  let row;
  try {
    const current = get(key);
    if ((current?.rev || 0) !== expectedRev) {
      throw Object.assign(new Error('Documento modificato: riconciliazione necessaria'), { status: 409, current });
    }
    row = db.prepare(`
      INSERT INTO documents (key, value, updated_at, rev) VALUES (?, ?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, rev = documents.rev + 1
      RETURNING updated_at, rev
    `).get(key, JSON.stringify(value), new Date().toISOString());
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  // Il backup non deve trasformare una scrittura confermata in un errore HTTP.
  backupDb();
  return row;
}

export function counts() {
  const rows = db.prepare('SELECT key, length(value) AS len FROM documents').all();
  const out = { documenti: rows.length };
  for (const r of rows) out[r.key] = r.len;
  return out;
}
