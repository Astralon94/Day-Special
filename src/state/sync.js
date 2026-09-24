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
  const pending = new Set();   // chiavi con modifiche locali non ancora confermate dal server
  const inFlight = new Set();
  const deferredRemote = new Map();
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
    setStatus('syncing');
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
    if (inFlight.has(key)) return;
    if (DS.get(key) === null) { pending.delete(key); return; }
    inFlight.add(key);
    pending.add(key);
    setStatus('syncing');
    let retryMs = PUSH_DEBOUNCE_MS;
    let failed = false;
    try {
      // Anche i retry leggono lo stato corrente prima di inviare. La revisione
      // attesa rende sicura la finestra fra questa GET e la PUT successiva.
      const latest = await fetch('/api/documents/' + key, { cache: 'no-store' });
      if (!latest.ok && latest.status !== 404) throw Object.assign(new Error('HTTP ' + latest.status), { status: latest.status });
      const current = latest.status === 404 ? null : await latest.json();
      if (current) reconcileRemote(key, current.value, current.rev, true);
      const expectedRev = current?.rev || 0;
      if (expectedRev < DS.getRev(key)) throw new Error('Snapshot server precedente alla revisione locale');
      const value = DS.get(key);
      if (current && DS.deepEqual(value, current.value)) {
        pending.delete(key);
        return;
      }
      const res = await fetch('/api/documents/' + key, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-DS-Client': CLIENT_ID },
        body: JSON.stringify({ value, expected_rev: expectedRev }),
      });
      if (res.status === 409) {
        const { current: conflict } = await res.json();
        if (conflict) reconcileRemote(key, conflict.value, conflict.rev, true);
        // Nuovo tentativo seriale: nessun popup e nessuna scrittura forzata.
        return;
      }
      if (!res.ok) throw Object.assign(new Error('HTTP ' + res.status), { status: res.status });
      const { rev } = await res.json();
      if (rev >= DS.getRev(key)) {
        DS.setBase(key, value);
        DS.setServerRev(key, rev);
      }
      if (DS.deepEqual(DS.get(key), DS.getBase(key))) pending.delete(key);
      pushAttempts[key] = 0;
    } catch (error) {
      failed = true;
      console.warn('Sync push error', key, error);
      const status = error.status;
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        retryMs = null;
        App.toast(status === 428 ? '⚠️ Aggiorna la pagina per continuare a salvare.' : '⚠️ Il server ha rifiutato il salvataggio (' + error.message + ')');
      } else {
        retryMs = retryDelay(++pushAttempts[key]);
      }
    } finally {
      inFlight.delete(key);
      const remote = deferredRemote.get(key);
      deferredRemote.delete(key);
      if (remote) {
        try { reconcileRemote(key, remote.value, remote.rev); }
        catch (error) {
          console.warn('Sync riconciliazione differita', error);
          failed = true;
          pending.add(key);
          retryMs = retryDelay(++pushAttempts[key]);
        }
      }
      if (pending.has(key) && retryMs !== null) schedulePush(key, retryMs);
      if (failed) setFailStatus(); else setIdleStatus();
    }
  }

  // ── Riconciliazione locale ↔ remoto con merge a 3 vie ────────────────────
  // Il "chi vince" tra campi scalari discordi è deciso dal `rev` (contatore
  // monotòno assegnato dal server), non dall'orologio del dispositivo: stesso
  // segnale di controllo delle modifiche concorrenti usato dalle Zen-Apps,
  // applicato per documento: anche un conflitto 409 si risolve con merge3,
  // senza chiedere all'utente di scegliere o forzare la scrittura.
  // Ritorna true se il dato LOCALE è cambiato (per decidere il toast/re-render).
  function reconcileRemote(key, remoteValue, remoteRev, duringPush = false) {
    // Gli snapshot vecchi non possono far regredire né contenuto né metadati.
    if (!Number.isSafeInteger(remoteRev) || remoteRev < DS.getRev(key)) return false;
    if (inFlight.has(key) && !duringPush) {
      const previous = deferredRemote.get(key);
      if (!previous || remoteRev >= previous.rev) deferredRemote.set(key, { value: remoteValue, rev: remoteRev });
      return false;
    }
    const local = DS.get(key);
    const base = DS.getBase(key);
    const preferRemote = remoteRev > DS.getRev(key);
    const merged = local === null ? remoteValue
      : base === null ? (preferRemote ? remoteValue : local)
      : DS.merge3(base, local, remoteValue, preferRemote);
    const changed = !DS.deepEqual(merged, local);
    const dirty = !DS.deepEqual(merged, remoteValue);
    if (changed) {
      if (dirty) DS.set(key, merged);
      else DS.applyRemote(key, merged, remoteRev);
      // Una scrittura locale fallita non deve avanzare la base del merge.
      if (!DS.deepEqual(DS.get(key), merged)) throw new Error('Aggiornamento locale non salvato');
    }
    // La base è sempre lo snapshot remoto osservato, non il risultato del merge
    // ancora da inviare: altrimenti le aggiunte remote possono risorgere o sparire.
    DS.setBase(key, remoteValue);
    DS.setRev(key, remoteRev);
    if (dirty) {
      pending.add(key);
      if (!inFlight.has(key)) schedulePush(key, PUSH_DEBOUNCE_MS);
    } else {
      pending.delete(key);
      clearTimeout(pushTimers[key]);
    }
    return changed;
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
    es.addEventListener('change', (ev) => {
      let r;
      try { r = JSON.parse(ev.data); } catch { return; }
      if (pulling) { buffered.push(r); return; }
      try { handleRemoteChange(r); } catch (error) { console.warn('Sync evento remoto', error); setFailStatus(); scheduleStart(); }
    });
    es.onopen = () => {
      // Il browser riapre lo stream da solo dopo una caduta: al riaggancio
      // recuperiamo ciò che è successo nel frattempo e riproviamo i push sospesi.
      // Anche la prima apertura recupera la finestra fra pull e sottoscrizione.
      resync();
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
