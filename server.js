// ============ Server HTTP — zero dipendenze (solo core Node) ============
// Nessuna autenticazione applicativa: in produzione l'accesso va protetto a monte.
// Le API restano aperte per chi raggiunge direttamente il server.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAll, put, counts } from './server/documents.js';
import { backupDb } from './server/db.js';
import * as updater from './server/updater.js';
import { DOC_KEYS } from './src/shared/docKeys.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const PORT = process.env.PORT || 4335;

// ---- Aggiornamento software (metodo Zen-Store: manifest + pacchetto su GitHub Releases) ----
const EXIT_RESTART = 42;
const UPDATE_URL = process.env.DS_UPDATE_URL !== undefined
  ? process.env.DS_UPDATE_URL
  : 'https://github.com/Astralon94/Day-Special/releases/latest/download/manifest.json';
let ultimoCheck = { corrente: updater.currentVersion(__dirname), disponibile: false, controllato_il: null };

async function controllaAggiornamenti() {
  if (!UPDATE_URL) return;
  try {
    const r = await updater.checkUpdate(UPDATE_URL, __dirname);
    ultimoCheck = { ...r, controllato_il: new Date().toISOString() };
    if (r.disponibile) console.log(`[update] disponibile la versione ${r.ultima} (attuale ${r.corrente})`);
  } catch { /* rete non disponibile: riprova al prossimo giro */ }
}
function programmaAggiornamenti() {
  if (!UPDATE_URL) return;
  controllaAggiornamenti();
  const t = setInterval(controllaAggiornamenti, 12 * 60 * 60 * 1000);
  if (t.unref) t.unref();
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
// Body JSON di una richiesta. I chunk restano Buffer fino alla fine: decodificarli
// uno per uno (`raw += chunk`) spezzerebbe i caratteri multibyte (accenti, emoji)
// che cadono a cavallo di due chunk. Oltre MAX_BODY_BYTES si risolve subito con
// BODY_TOO_LARGE senza accumulare altro: senza autenticazione, un body illimitato
// è un modo banale per esaurire la memoria del server (e poi quella dei client,
// a cui il documento verrebbe rimandato via SSE).
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const BODY_TOO_LARGE = Symbol('body-too-large');
const readBody = (req) => new Promise((resolve) => {
  const chunks = [];
  let size = 0, done = false;
  const finish = (v) => { if (!done) { done = true; resolve(v); } };
  req.on('data', (c) => {
    if (done) return;
    size += c.length;
    if (size > MAX_BODY_BYTES) { finish(BODY_TOO_LARGE); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    try { finish(raw ? JSON.parse(raw) : {}); } catch { finish(null); }
  });
  // Connessione caduta a metà body: la promise non deve restare pendente.
  req.on('error', () => finish(null));
  req.on('close', () => finish(null));
});

// ---- Realtime (Server-Sent Events): sostituto locale di Supabase Realtime ----
const sseClients = new Set();
// `origin` è l'id istanza del client che ha fatto la PUT (header X-DS-Client):
// l'evento arriva anche a lui, e così può riconoscere l'eco e ignorarlo.
function broadcast(key, value, updated_at, rev, origin) {
  const payload = `event: change\ndata: ${JSON.stringify({ key, value, updated_at, rev, origin })}\n\n`;
  for (const res of sseClients) { try { res.write(payload); } catch {} }
}
// Heartbeat: un commento SSE ogni 25 s tiene viva la connessione attraverso
// proxy e tunnel che chiudono gli stream inattivi (Cloudflare dopo ~100 s).
const SSE_HEARTBEAT_MS = 25000;
const heartbeat = setInterval(() => {
  for (const res of sseClients) { try { res.write(': ping\n\n'); } catch {} }
}, SSE_HEARTBEAT_MS);
if (heartbeat.unref) heartbeat.unref();

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', <resource>, <id>?]
  const resource = parts[1], id = parts[2];
  const method = req.method;

  if (resource === 'health' && method === 'GET') {
    return json(res, 200, { ok: true, app: 'day-special-server', ...counts() });
  }

  // Stato completo: boot iniziale del client (equivalente al fetch iniziale di Sync.fullSync()).
  if (resource === 'data' && method === 'GET') {
    return json(res, 200, getAll());
  }

  // Upsert di un singolo documento + broadcast SSE ai client connessi.
  if (resource === 'documents' && id && method === 'PUT') {
    if (!DOC_KEYS.includes(id)) return json(res, 400, { error: 'Chiave non valida: ' + id });
    const b = await readBody(req);
    if (b === BODY_TOO_LARGE) {
      res.setHeader('Connection', 'close');
      return json(res, 413, { error: `Documento troppo grande (massimo ${MAX_BODY_BYTES / 1024 / 1024} MB)` });
    }
    if (b == null || typeof b.value !== 'object' || b.value === null) {
      return json(res, 400, { error: 'Body non valido: atteso { value }' });
    }
    const origin = String(req.headers['x-ds-client'] || '').slice(0, 64);
    try {
      const { updated_at, rev } = put(id, b.value);
      broadcast(id, b.value, updated_at, rev, origin);
      return json(res, 200, { updated_at, rev });
    } catch (e) { return json(res, 400, { error: String(e.message || e) }); }
  }

  // Stream SSE: un evento 'change' per ogni PUT riuscito di un altro client/dispositivo.
  if (resource === 'stream' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(': connesso\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ---- AGGIORNAMENTO SOFTWARE ----
  if (resource === 'updates') {
    if (method === 'GET') return json(res, 200, { ...ultimoCheck, url_configurato: !!UPDATE_URL });
    if (method === 'POST' && id === 'check') {
      if (!UPDATE_URL) return json(res, 400, { error: 'Aggiornamenti disattivati (DS_UPDATE_URL vuota)' });
      try {
        const r = await updater.checkUpdate(UPDATE_URL, __dirname);
        ultimoCheck = { ...r, controllato_il: new Date().toISOString() };
        return json(res, 200, ultimoCheck);
      } catch (e) { return json(res, 502, { error: 'Controllo fallito: ' + e.message }); }
    }
    if (method === 'POST' && id === 'install') {
      if (!UPDATE_URL) return json(res, 400, { error: 'Aggiornamenti disattivati (DS_UPDATE_URL vuota)' });
      try {
        const chk = await updater.checkUpdate(UPDATE_URL, __dirname);
        if (!chk.disponibile) return json(res, 409, { error: 'Nessun aggiornamento disponibile' });
        if (!chk.download_url) return json(res, 400, { error: 'Il manifest non indica il pacchetto (url)' });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rep = await updater.installaAggiornamento(chk.download_url, { appDir: __dirname, dataDir: join(__dirname, 'data'), stamp });
        try { backupDb({ force: true }); } catch {}
        setTimeout(() => process.exit(EXIT_RESTART), 800);
        return json(res, 200, { ok: true, ...rep, riavvio: true });
      } catch (e) { return json(res, 500, { error: 'Installazione fallita: ' + e.message }); }
    }
  }

  return json(res, 404, { error: 'endpoint non trovato' });
}

function statusPage() {
  const c = counts();
  const rows = Object.entries(c).filter(([k]) => k !== 'documenti')
    .map(([k, v]) => `<tr><td>${k}</td><td style="text-align:right">${v} byte</td></tr>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>Day-Special server</title>
  <style>body{font:15px/1.5 system-ui;margin:3rem auto;max-width:34rem;color:#26303a}
  h1{font-size:1.2rem}code{background:#eef;padding:.1em .35em;border-radius:4px}
  table{border-collapse:collapse;margin-top:1rem}td{border-bottom:1px solid #e5e7eb;padding:.3rem .8rem}</style>
  <h1>🟢 Day-Special — server dati attivo</h1>
  <p>DB documentale (node:sqlite) — <b>${c.documenti} documenti</b>. Frontend non ancora buildato (public/index.html assente).</p>
  <p>API: <code>GET /api/data</code> · <code>PUT /api/documents/:key</code> · <code>GET /api/stream</code> · <code>GET /api/health</code></p>
  <table><tr><th style="text-align:left">Chiave</th><th>Dimensione</th></tr>${rows}</table>`;
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/favicon.ico') rel = '/icon-512.png';
  if (rel === '/') {
    try { const html = await readFile(join(PUBLIC, 'index.html')); res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }); return res.end(html); }
    catch { res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' }); return res.end(statusPage()); }
  }
  const filePath = normalize(join(PUBLIC, rel));
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    // SPA con routing lato client via hash (#/invitati): nessun path server-side da gestire,
    // ma un refresh su un asset inesistente resta un 404 genuino (niente catch-all necessario).
    res.writeHead(404); res.end('Not found');
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    return await serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    json(res, 500, { error: 'Errore interno', detail: String(err.message || err) });
  }
}).listen(PORT, () => {
  console.log(`\n  Day-Special — server dati (v${updater.currentVersion(__dirname)})`);
  console.log(`  ▸ http://localhost:${PORT}`);
  console.log(`  ▸ ${counts().documenti} documenti\n`);
  programmaAggiornamenti();
});
