// Smoke test del server senza toccare il DB su disco né controllare release.
// Avvia server.js come processo figlio con DB in memoria, interroga /api/health
// e /api/data, poi lo chiude da solo: un unico processo Node, niente `&` né `kill`
// nella shell (bloccati in alcune modalità di permesso di Claude Code).
// Uso:  node scripts/smoke.mjs [porta]      (default 4435; mai 4335, riservata alla produzione)
// Esce con 0 se entrambi gli endpoint rispondono 200, altrimenti con 1 e stampa il log del server.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.argv[2] || '4435';
const BASE = `http://localhost:${PORT}`;
const ENDPOINT = ['/api/health', '/api/data'];
const TENTATIVI = 40;   // × 250 ms = 10 s massimi di attesa per l'avvio
const TIMEOUT_MS = 3000;

if (PORT === '4335') {
  console.error('La porta 4335 è riservata alla produzione locale: usa un\'altra porta.');
  process.exit(1);
}

const child = spawn(process.execPath, [join(APP, 'server.js')], {
  cwd: APP,
  env: { ...process.env, DS_DB: ':memory:', DS_UPDATE_URL: '', PORT },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));
let uscitoPrima = null;
child.on('exit', (code, signal) => { uscitoPrima = { code, signal }; });

async function chiama(path) {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return { status: res.status, body: await res.text() };
}

// Attende che il server accetti connessioni.
let health = null, ultimoErrore = null;
for (let i = 0; i < TENTATIVI && !uscitoPrima; i++) {
  await new Promise((r) => setTimeout(r, 250));
  try { health = await chiama('/api/health'); break; }
  catch (e) { ultimoErrore = e.message; }
}

const esiti = [];
if (health) {
  esiti.push({ path: '/api/health', ...health });
  for (const path of ENDPOINT.slice(1)) {
    try { esiti.push({ path, ...(await chiama(path)) }); }
    catch (e) { esiti.push({ path, status: 0, body: e.message }); }
  }
}

if (!uscitoPrima) {
  child.kill('SIGTERM');
  await new Promise((r) => child.on('exit', r));
}

let ok = Boolean(health);
for (const e of esiti) {
  const bene = e.status === 200;
  ok = ok && bene;
  const corpo = e.body.length > 200 ? e.body.slice(0, 200) + '…' : e.body;
  console.log(`${bene ? 'OK ' : 'KO '} ${e.path} → ${e.status} ${corpo}`);
}
if (!health) {
  console.log(`KO  il server non ha risposto su ${BASE}` +
    (uscitoPrima ? ` (uscito con code=${uscitoPrima.code} signal=${uscitoPrima.signal})` : '') +
    (ultimoErrore ? `: ${ultimoErrore}` : ''));
}
if (!ok) console.log('--- log del server:\n' + log.trim());
process.exit(ok ? 0 : 1);
