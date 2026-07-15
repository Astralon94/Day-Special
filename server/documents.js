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

// Upsert atomico con incremento di `rev` (1 alla creazione, +1 ad ogni scrittura
// successiva) fatto interamente in SQL via RETURNING: nessuna finestra di race
// possibile tra la lettura del rev corrente e la scrittura (Node è single-thread
// e la query è una singola statement sincrona).
export function put(key, value) {
  if (!DOC_KEYS.includes(key)) throw new Error('Chiave non valida: ' + key);
  if (value === undefined || value === null || typeof value !== 'object') {
    throw new Error('Valore non valido per ' + key);
  }
  const updated_at = new Date().toISOString();
  const row = db.prepare(`
    INSERT INTO documents (key, value, updated_at, rev) VALUES (?, ?, ?, 1)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, rev = documents.rev + 1
    RETURNING updated_at, rev
  `).get(key, JSON.stringify(value), updated_at);
  backupDb(); // throttled, non forzato: non rallenta ogni singolo salvataggio
  return row;
}

export function counts() {
  const rows = db.prepare('SELECT key, length(value) AS len FROM documents').all();
  const out = { documenti: rows.length };
  for (const r of rows) out[r.key] = r.len;
  return out;
}
