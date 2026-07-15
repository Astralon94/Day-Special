// ============ Data layer — node:sqlite (nessuna dipendenza esterna) ============
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, '..', 'data');
export const DB_PATH = process.env.DS_DB || join(DATA_DIR, 'day-special.db');
const onDisk = DB_PATH !== ':memory:';
if (onDisk) mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Modello key-value: ogni riga è un documento JSON opaco (ds_invitati, ds_checklist, ...).
// Niente collezioni relazionali: la struttura interna dei documenti è affare del client
// (merge a 3 vie in src/state/storage.js), il server la tratta come blob.
// `rev` è un contatore monotòno per chiave, incrementato dal server ad ogni
// scrittura: è il segnale usato per il controllo delle modifiche concorrenti
// (di chi è la versione più recente) — più robusto di un confronto sugli
// orologi dei singoli dispositivi. Non blocca le scritture (nessun 409): la
// fusione dei contenuti resta il merge a 3 vie lato client.
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
  lastBackupAt = now;
  try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); } catch {}
  const dir = join(DATA_DIR, 'backups');
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, `day-special-${stamp()}.db`);
  try { copyFileSync(DB_PATH, dest); } catch { return null; }
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.db')).sort();
    for (let i = 0; i < files.length - KEEP_BACKUPS; i++) unlinkSync(join(dir, files[i]));
  } catch {}
  return dest;
}
