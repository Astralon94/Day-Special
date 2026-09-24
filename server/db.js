// ============ Data layer — node:sqlite (nessuna dipendenza esterna) ============
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, '..', 'data');
export const DB_PATH = process.env.DS_DB || join(DATA_DIR, 'day-special.db');
const onDisk = DB_PATH !== ':memory:';
if (onDisk) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL;');

// I documenti storici restano nella stessa tabella: nessuna migrazione distruttiva.
// Il servizio di dominio interpreta e valida i dati e aggiorna tutte le chiavi
// coinvolte in una sola transazione con ricevuta idempotente.
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    rev        INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
`);
// Migrazione additiva per DB creati prima dell'introduzione di `rev`: idempotente,
// non tocca valori/righe esistenti (default 1 per le righe già presenti).
try { db.exec('ALTER TABLE documents ADD COLUMN rev INTEGER NOT NULL DEFAULT 1'); } catch {}

const p2 = (n) => String(n).padStart(2, '0');
function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

const KEEP_BACKUPS = 20;
const MIN_BACKUP_INTERVAL = 120000; // 2 minuti
let lastBackupAt = 0;
export function backupDb({ force = false } = {}) {
  if (!onDisk || !existsSync(DB_PATH)) return null;
  const now = Date.now();
  if (!force && now - lastBackupAt < MIN_BACKUP_INTERVAL) return null;
  const dir = join(DATA_DIR, 'backups');
  const dest = join(dir, `day-special-${stamp()}-${randomUUID()}.db`);
  const temporary = dest + '.tmp';
  try {
    mkdirSync(dir, { recursive: true });
    // SQLite include anche le pagine WAL, senza dipendere dal checkpoint
    // e senza essere bloccato dalle transazioni di lettura di altri processi.
    db.prepare('VACUUM INTO ?').run(temporary);
    const snapshot = new DatabaseSync(temporary, { readOnly: true });
    try {
      const result = snapshot.prepare('PRAGMA integrity_check').all();
      if (result.length !== 1 || result[0].integrity_check !== 'ok') throw new Error('Backup non integro');
    } finally { snapshot.close(); }
    renameSync(temporary, dest);
    lastBackupAt = now;
  } catch (error) {
    try { unlinkSync(temporary); } catch {}
    console.error('Backup database fallito:', error.message);
    return null;
  }
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
    for (let i = 0; i < files.length - KEEP_BACKUPS; i++) unlinkSync(join(dir, files[i]));
  } catch (error) { console.error('Pulizia backup fallita:', error.message); }
  return dest;
}
