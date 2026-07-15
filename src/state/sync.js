/**
 * Day Special – Sync layer (server Node/sqlite locale, ex Supabase)
 *
 * Strategia: offline-first, invariata rispetto alla versione Supabase.
 *  - localStorage resta la fonte primaria per la UI (l'app funziona anche offline).
 *  - Ogni DS.set locale viene messo in coda e fatto PUT su /api/documents/:key (debounce).
 *  - All'avvio: pull completo (GET /api/data) con merge a 3 vie per chiave.
 *  - Realtime: le modifiche fatte dall'altro dispositivo arrivano via Server-Sent
 *    Events (/api/stream) e vengono applicate con DS.applyRemote → le pagine si
 *    ri-renderizzano.
 *
 * Nessun login applicativo: la protezione è solo Cloudflare Access davanti al
 * tunnel in produzione. Sempre attivo (non esiste "modalità solo-locale" opzionale
 * come con Supabase: il server è lo stesso host che serve l'app).
 */
import { DS } from './storage.js';
import { App } from '../ui/app.js';

export const Sync = (() => {

  let pushTimers = {};
  let pushRetries = {};
  let eventSource = null;
  let status = 'connecting'; // connecting | synced | syncing | offline | error
  const MAX_PUSH_RETRIES = 3;

  const STATUS_UI = {
    connecting: ['🔄', 'Connessione al server...'],
    syncing:    ['🔄', 'Sincronizzazione in corso...'],
    synced:     ['☁️', 'Sincronizzato'],
    offline:    ['📴', 'Offline: le modifiche verranno sincronizzate alla riconnessione'],
    error:      ['⚠️', 'Errore di sincronizzazione: dati salvati solo in locale'],
  };

  function setStatus(s) {
    status = s;
    const el = document.getElementById('sync-status');
    if (!el) return;
    const [icon, title] = STATUS_UI[s] || ['', ''];
    el.textContent = icon;
    el.title = title;
  }

  // Inserisce l'indicatore di stato nell'header della vista corrente (chiamata
  // dal router dopo ogni mount: l'header è nuovo ad ogni cambio vista).
  function injectHeaderUI() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('sync-status')) return;
    const span = document.createElement('span');
    span.id = 'sync-status';
    span.style.cssText = 'font-size:1rem;cursor:default';
    actions.insertBefore(span, actions.firstChild);
    setStatus(status);
  }

  // ── Push (locale → server) ────────────────────────────────────────────────
  function queuePush(key) {
    pushRetries[key] = MAX_PUSH_RETRIES;
    clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(() => pushKey(key), 600);
  }

  async function pushKey(key) {
    const value = DS.get(key);
    if (value === null) return;
    setStatus('syncing');
    try {
      const res = await fetch('/api/documents/' + key, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const { updated_at } = await res.json();
      // Allinea il meta locale al timestamp autorevole restituito dal server.
      if (updated_at) DS.setServerMeta(key, updated_at);
      // Ciò che abbiamo appena inviato è ora lo stato "concordato" col server:
      // diventa la base per i futuri merge a 3 vie.
      DS.setBase(key, value);
      setStatus('synced');
    } catch (error) {
      console.warn('Sync push error', key, error);
      setStatus(navigator.onLine ? 'error' : 'offline');
      if (navigator.onLine && pushRetries[key] > 0) {
        pushRetries[key]--;
        clearTimeout(pushTimers[key]);
        pushTimers[key] = setTimeout(() => pushKey(key), (MAX_PUSH_RETRIES - pushRetries[key]) * 2000);
      }
    }
  }

  // ── Riconciliazione locale ↔ remoto con merge a 3 vie ────────────────────
  // Ritorna true se il dato LOCALE è cambiato (per decidere il toast/re-render).
  function reconcileRemote(key, remoteValue, remoteTsMs) {
    const local = DS.get(key);
    const remoteIso = new Date(remoteTsMs).toISOString();

    if (local === null) {
      DS.applyRemote(key, remoteValue, remoteIso);
      DS.setBase(key, remoteValue);
      return true;
    }

    if (DS.deepEqual(remoteValue, local)) {
      DS.setBase(key, local);
      return false;
    }

    const base = DS.getBase(key);
    const localTs = DS.getMeta()[key] ? Date.parse(DS.getMeta()[key]) : 0;
    const preferRemote = remoteTsMs > localTs;

    if (base === null) {
      if (preferRemote) {
        DS.applyRemote(key, remoteValue, remoteIso);
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
      DS.applyRemote(key, merged, remoteIso);
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
    return false;
  }

  // ── Pull iniziale (server → locale, con merge a 3 vie per chiave) ────────
  async function fullSync() {
    setStatus('syncing');
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const remote = await res.json(); // { [key]: { value, updated_at } }

    for (const key of DS.KEYS) {
      const r = remote[key];
      const local = DS.get(key);
      if (!r && local === null) continue;
      if (!r) { await pushKey(key); continue; }
      reconcileRemote(key, r.value, Date.parse(r.updated_at));
    }
    setStatus('synced');
  }

  // ── Realtime (modifiche dall'altro dispositivo) via Server-Sent Events ───
  function subscribeRealtime() {
    if (eventSource) { eventSource.close(); eventSource = null; }
    eventSource = new EventSource('/api/stream');
    eventSource.addEventListener('change', (ev) => {
      let r;
      try { r = JSON.parse(ev.data); } catch { return; }
      if (!r || !DS.KEYS.includes(r.key)) return;
      if (reconcileRemote(r.key, r.value, Date.parse(r.updated_at))) {
        App.toast('☁️ Dati aggiornati dall\'altro dispositivo');
      }
    });
    eventSource.onerror = () => {
      // Il browser riprova automaticamente la connessione SSE; riflettiamo lo
      // stato solo se risulta anche offline dal punto di vista di rete.
      if (!navigator.onLine) setStatus('offline');
    };
  }

  async function startSync() {
    try {
      await fullSync();
      subscribeRealtime();
    } catch (e) {
      console.warn('Sync error', e);
      setStatus(navigator.onLine ? 'error' : 'offline');
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

  return { init, onViewMounted, get status() { return status; } };
})();

if (typeof window !== 'undefined') window.Sync = Sync;
