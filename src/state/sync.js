/**
 * Day Special – Sync layer (server Node/sqlite locale, ex Supabase)
 *
 * Strategia: offline-first, invariata rispetto alla versione Supabase.
 *  - localStorage resta la fonte primaria per la UI (l'app funziona anche offline).
 *  - Ogni DS.set locale viene messo in coda e fatto PUT su /api/documents/:key (debounce).
 *    La chiave resta "in sospeso" finché il server non conferma: i tentativi
 *    falliti vengono ripetuti con backoff senza limite, e ripresi subito alla
 *    riconnessione (evento online o riaggancio dello stream SSE).
 *  - All'avvio: pull completo (GET /api/data) con merge a 3 vie per chiave;
 *    se fallisce si riprova con backoff finché il server non risponde.
 *  - Realtime: le modifiche fatte dall'altro dispositivo arrivano via Server-Sent
 *    Events (/api/stream) e vengono applicate con DS.applyRemote → le pagine si
 *    ri-renderizzano. Il server rimanda l'evento anche a chi ha fatto la PUT:
 *    quell'eco viene riconosciuto (id istanza) e ignorato, altrimenti il merge
 *    riporterebbe indietro ciò che l'utente ha scritto nel frattempo.
 *    A ogni riconnessione dello stream si rifà il pull completo: gli eventi
 *    emessi mentre lo stream era caduto (server riavviato, proxy che chiude le
 *    connessioni inattive) non sono recuperabili in altro modo.
 *
 * Nessun login applicativo: la protezione è solo Cloudflare Access davanti al
 * tunnel in produzione. Sempre attivo (non esiste "modalità solo-locale" opzionale
 * come con Supabase: il server è lo stesso host che serve l'app).
 */
import { DS } from './storage.js';
import { App } from '../ui/app.js';

export const Sync = (() => {

  // Identità di questa istanza (una per tab): viaggia nell'header X-DS-Client
  // delle PUT e torna come `origin` negli eventi SSE, per riconoscere l'eco
  // dei propri salvataggi. crypto.randomUUID esiste solo in contesto sicuro
  // (https/localhost): in LAN via http serve il fallback.
  const CLIENT_ID = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);

  const PUSH_DEBOUNCE_MS = 600;
  const RETRY_BASE_MS = 2000;
  const RETRY_MAX_MS = 60000;

  let pushTimers = {};
  let pushAttempts = {};
  let pushGen = {};            // contatore per chiave: distingue la modifica in volo da una più recente
  const pending = new Set();   // chiavi con modifiche locali non ancora confermate dal server
  let eventSource = null;
  let status = 'connecting'; // connecting | synced | syncing | offline | error

  // Spia di salvataggio: riflette lo stato REALE confermato dal server (non un
  // ottimistico "salvato" mostrato subito dopo la digitazione), come nelle
  // Zen-Apps. `syncing`/`connecting` = c'è almeno una scrittura non ancora
  // confermata; `synced` = tutto confermato; `error`/`offline` = l'ultimo
  // tentativo non è riuscito (dati comunque al sicuro in locale, si riprova).
  const STATUS_UI = {
    connecting: { c: 'var(--muted)',   dot: '◍', t: 'Connessione al server…' },
    syncing:    { c: 'var(--gold-txt)', dot: '◍', t: 'Salvataggio…' },
    synced:     { c: 'var(--success)', dot: '●', t: 'Salvato' },
    offline:    { c: 'var(--muted)',   dot: '📴', t: 'Offline — verrà salvato alla riconnessione' },
    error:      { c: 'var(--danger)',  dot: '▲', t: 'Non salvato — nuovo tentativo in corso' },
  };

  function setStatus(s) {
    status = s;
    const el = document.getElementById('sync-status');
    if (!el) return;
    const m = STATUS_UI[s] || STATUS_UI.connecting;
    el.style.color = m.c;
    el.title = m.t;
    el.innerHTML = `${m.dot} <span class="sb-txt">${m.t}</span>`;
  }
  // Stato "a riposo": tutto confermato oppure c'è ancora qualcosa in coda.
  function setIdleStatus() { setStatus(pending.size ? 'syncing' : 'synced'); }
  function setFailStatus() { setStatus(navigator.onLine ? 'error' : 'offline'); }

  // Inserisce l'indicatore di stato nell'header della vista corrente (chiamata
  // dal router dopo ogni mount: l'header è nuovo ad ogni cambio vista).
  function injectHeaderUI() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('sync-status')) return;
    const span = document.createElement('span');
    span.id = 'sync-status';
    span.className = 'save-badge';
    actions.insertBefore(span, actions.firstChild);
    setStatus(status);
  }

  // ── Push (locale → server) ────────────────────────────────────────────────
  // Backoff esponenziale con tetto: 2s, 4s, 8s … 60s, poi 60s fissi.
  function retryDelay(attempt) {
    return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1));
  }

  function schedulePush(key, ms) {
    clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(() => pushKey(key), ms);
  }

  function queuePush(key) {
    pending.add(key);
    pushGen[key] = (pushGen[key] || 0) + 1;
    pushAttempts[key] = 0;
    schedulePush(key, PUSH_DEBOUNCE_MS);
  }

  // Ritenta subito tutto ciò che è in sospeso (riconnessione).
  function flushPending() {
    for (const key of [...pending]) {
      pushAttempts[key] = 0;
      schedulePush(key, 0);
    }
  }

  async function pushKey(key) {
    clearTimeout(pushTimers[key]);
    const value = DS.get(key);
    if (value === null) { pending.delete(key); return; }
    pending.add(key);
    const gen = pushGen[key] || 0;
    setStatus('syncing');
    try {
      const res = await fetch('/api/documents/' + key, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-DS-Client': CLIENT_ID },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        const err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      }
      const { rev } = await res.json();
      // Allinea il rev locale a quello autorevole restituito dal server.
      if (rev != null) DS.setServerRev(key, rev);
      // Ciò che abbiamo appena inviato è ora lo stato "concordato" col server:
      // diventa la base per i futuri merge a 3 vie.
      DS.setBase(key, value);
      // Se nel frattempo è arrivata una modifica più recente, il suo timer è
      // già armato e la chiave deve restare in sospeso.
      if ((pushGen[key] || 0) === gen) pending.delete(key);
      pushAttempts[key] = 0;
      setIdleStatus();
    } catch (error) {
      console.warn('Sync push error', key, error);
      setFailStatus();
      // Un 4xx (chiave non valida, body troppo grande…) non si risolve
      // riprovando: si avvisa e si aspetta la prossima modifica o riconnessione.
      const s = error.status;
      if (s >= 400 && s < 500 && s !== 408 && s !== 429) {
        App.toast('⚠️ Il server ha rifiutato il salvataggio (' + error.message + ')');
        return;
      }
      if ((pushGen[key] || 0) === gen) schedulePush(key, retryDelay(++pushAttempts[key]));
    }
  }

  // ── Riconciliazione locale ↔ remoto con merge a 3 vie ────────────────────
  // Il "chi vince" tra campi scalari discordi è deciso dal `rev` (contatore
  // monotòno assegnato dal server), non dall'orologio del dispositivo: stesso
  // segnale di controllo delle modifiche concorrenti usato dalle Zen-Apps,
  // applicato per documento invece che con un rifiuto/409 — qui il contenuto
  // si fonde sempre in automatico (merge3), non si chiede mai all'utente di
  // scegliere.
  // Ritorna true se il dato LOCALE è cambiato (per decidere il toast/re-render).
  function reconcileRemote(key, remoteValue, remoteRev) {
    const local = DS.get(key);

    if (local === null) {
      DS.applyRemote(key, remoteValue, remoteRev);
      DS.setBase(key, remoteValue);
      return true;
    }

    if (DS.deepEqual(remoteValue, local)) {
      DS.setBase(key, local);
      DS.setRev(key, remoteRev);
      return false;
    }

    const base = DS.getBase(key);
    const preferRemote = remoteRev > DS.getRev(key);

    if (base === null) {
      if (preferRemote) {
        DS.applyRemote(key, remoteValue, remoteRev);
        DS.setBase(key, remoteValue);
        return true;
      }
      DS.set(key, local);
      return false;
    }

    const merged = DS.merge3(base, local, remoteValue, preferRemote);
    const changedLocally    = !DS.deepEqual(merged, local);
    const differsFromRemote = !DS.deepEqual(merged, remoteValue);

    if (changedLocally && !differsFromRemote) {
      DS.applyRemote(key, merged, remoteRev);
      DS.setBase(key, merged);
      return true;
    }
    if (changedLocally) {
      DS.set(key, merged);
      return true;
    }
    if (differsFromRemote) {
      DS.set(key, merged);
      return false;
    }
    DS.setBase(key, merged);
    DS.setRev(key, remoteRev);
    return false;
  }

  // Un evento SSE (già decodificato). L'eco del proprio push viene ignorato:
  // rev e base li allinea già pushKey con la risposta della PUT.
  function handleRemoteChange(r) {
    if (!r || !DS.KEYS.includes(r.key)) return;
    if (r.origin && r.origin === CLIENT_ID) return;
    if (reconcileRemote(r.key, r.value, r.rev)) {
      App.toast('☁️ Dati aggiornati dall\'altro dispositivo');
    }
  }

  // ── Pull completo (server → locale, con merge a 3 vie per chiave) ────────
  // Gli eventi SSE che arrivano durante il pull vengono accodati e applicati
  // dopo: sono più recenti dello snapshot e applicarli prima farebbe regredire
  // il dato quando lo snapshot (più vecchio) viene riconciliato.
  let pulling = false;
  let pullPromise = null;
  let pulled = false;          // almeno un pull completo riuscito da quando la pagina è aperta
  const buffered = [];

  function fullSync() {
    if (!pullPromise) {
      pullPromise = doFullSync().finally(() => { pullPromise = null; });
    }
    return pullPromise;
  }

  async function doFullSync() {
    pulling = true;
    setStatus('syncing');
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const remote = await res.json(); // { [key]: { value, updated_at, rev } }

      for (const key of DS.KEYS) {
        const r = remote[key];
        const local = DS.get(key);
        if (!r && local === null) continue;
        if (!r) { await pushKey(key); continue; }
        reconcileRemote(key, r.value, r.rev);
      }
    } finally {
      pulling = false;
      while (buffered.length) handleRemoteChange(buffered.shift());
    }
    pulled = true;
    // Le viste che seminano dati di default (checklist) aspettano questo
    // segnale: solo ora si sa se il server ha già qualcosa per quella chiave.
    window.dispatchEvent(new CustomEvent('ds:pulled'));
    setIdleStatus();
  }

  // ── Realtime (modifiche dall'altro dispositivo) via Server-Sent Events ───
  function subscribeRealtime() {
    if (eventSource) { eventSource.close(); eventSource = null; }
    const es = new EventSource('/api/stream');
    eventSource = es;
    let opened = false;
    es.addEventListener('change', (ev) => {
      let r;
      try { r = JSON.parse(ev.data); } catch { return; }
      if (pulling) { buffered.push(r); return; }
      handleRemoteChange(r);
    });
    es.onopen = () => {
      // Il browser riapre lo stream da solo dopo una caduta: al riaggancio
      // recuperiamo ciò che è successo nel frattempo e riproviamo i push sospesi.
      if (opened) resync();
      opened = true;
    };
    es.onerror = () => {
      // Il browser riprova automaticamente la connessione SSE; riflettiamo lo
      // stato solo se risulta anche offline dal punto di vista di rete.
      if (!navigator.onLine) setStatus('offline');
    };
  }

  async function resync() {
    try {
      await fullSync();
      flushPending();
    } catch (e) {
      console.warn('Sync resync error', e);
      setFailStatus();
      scheduleStart();
    }
  }

  // ── Avvio (con retry a backoff finché il server non risponde) ────────────
  let startTimer = null;
  let startAttempts = 0;

  function scheduleStart() {
    clearTimeout(startTimer);
    startTimer = setTimeout(startSync, retryDelay(++startAttempts));
  }

  async function startSync() {
    clearTimeout(startTimer);
    try {
      await fullSync();
      startAttempts = 0;
      subscribeRealtime();
      flushPending();
    } catch (e) {
      console.warn('Sync error', e);
      setFailStatus();
      scheduleStart();
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  let initialized = false;
  function init() {
    if (initialized) return;
    initialized = true;
    window.addEventListener('ds:change', e => {
      if (!e.detail.remote && DS.KEYS.includes(e.detail.key)) queuePush(e.detail.key);
    });
    window.addEventListener('online', () => startSync());
    window.addEventListener('offline', () => setStatus('offline'));
    startSync();
  }

  // Da richiamare dal router ad ogni mount di vista (rimonta l'indicatore
  // nell'header, che è nuovo ad ogni cambio vista).
  function onViewMounted() {
    injectHeaderUI();
  }

  return { init, onViewMounted, get status() { return status; }, get pending() { return pending.size; }, get pulled() { return pulled; } };
})();

if (typeof window !== 'undefined') window.Sync = Sync;
