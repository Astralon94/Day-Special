// ============ Documenti key-value: get/put/counts ============
import { db } from './db.js';
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

export function counts() {
  const rows = db.prepare('SELECT key, length(value) AS len FROM documents').all();
  const out = { documenti: rows.length };
  for (const r of rows) out[r.key] = r.len;
  return out;
}
