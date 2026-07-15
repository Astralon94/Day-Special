// ============ Documenti key-value: get/put/counts ============
import { db, backupDb } from './db.js';
import { DOC_KEYS } from '../src/shared/docKeys.js';

// Tutti i documenti presenti (una chiave assente = "mai salvata", comportamento
// identico a una localStorage vuota: non viene seminato alcun default).
export function getAll() {
  const out = {};
  for (const row of db.prepare('SELECT key, value, updated_at FROM documents').all()) {
    if (!DOC_KEYS.includes(row.key)) continue;
    out[row.key] = { value: JSON.parse(row.value), updated_at: row.updated_at };
  }
  return out;
}

export function get(key) {
  if (!DOC_KEYS.includes(key)) return null;
  const row = db.prepare('SELECT value, updated_at FROM documents WHERE key = ?').get(key);
  if (!row) return null;
  return { value: JSON.parse(row.value), updated_at: row.updated_at };
}

export function put(key, value) {
  if (!DOC_KEYS.includes(key)) throw new Error('Chiave non valida: ' + key);
  if (value === undefined || value === null || typeof value !== 'object') {
    throw new Error('Valore non valido per ' + key);
  }
  const updated_at = new Date().toISOString();
  db.prepare(`
    INSERT INTO documents (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, JSON.stringify(value), updated_at);
  backupDb(); // throttled, non forzato: non rallenta ogni singolo salvataggio
  return updated_at;
}

export function counts() {
  const rows = db.prepare('SELECT key, length(value) AS len FROM documents').all();
  const out = { documenti: rows.length };
  for (const r of rows) out[r.key] = r.len;
  return out;
}
