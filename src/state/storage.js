// Cache di sola lettura di snapshot CONFERMATI. Nessun merge o documento locale scrivibile.
import { DOC_KEYS } from '../shared/docKeys.js';
import { App } from '../ui/app.js';
export const DS = (() => {
  const CACHE = 'ds_server_cache_v2';
  let snapshot = null,
    online = false,
    busy = false,
    error = '',
    refreshPromise = null;
  let generation = 0,
    outstanding = null;
  const copy = (x) => (x == null ? null : JSON.parse(JSON.stringify(x)));
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE));
    if (saved?.protocol === 2) snapshot = saved;
  } catch {}
  function status() {
    return outstanding
      ? 'uncertain'
      : busy
        ? 'saving'
        : online
          ? 'synced'
          : snapshot
            ? 'offline'
            : 'connecting';
  }
  function restoreViews() {
    for (const key of DOC_KEYS)
      window.dispatchEvent(new CustomEvent('ds:change', { detail: { key, remote: true } }));
  }
  function announce() {
    window.dispatchEvent(new CustomEvent('ds:status'));
  }
  function revisions() {
    return Object.fromEntries(DOC_KEYS.map((k) => [k, snapshot?.documents[k]?.rev || 0]));
  }
  function apply(next) {
    if (next?.protocol !== 2 || !DOC_KEYS.every((k) => next.documents?.[k]?.value || next.documents?.[k]?.error))
      throw new Error('Risposta del server non valida');
    const before = snapshot;
    snapshot = copy(next);
    try {
      localStorage.setItem(CACHE, JSON.stringify(snapshot));
    } catch {
      /* La cache non condiziona il commit. */
    }
    for (const key of DOC_KEYS)
      if (JSON.stringify(before?.documents[key]) !== JSON.stringify(snapshot.documents[key])) {
        window.dispatchEvent(new CustomEvent('ds:change', { detail: { key, remote: true } }));
      }
    window.dispatchEvent(new CustomEvent('ds:ready'));
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(path, {
        cache: 'no-store',
        ...options,
        signal: controller.signal,
      });
      const body = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(body.error || 'Errore del server'), {
          status: response.status,
        });
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }
  async function refresh() {
    if (busy || outstanding) return;
    if (refreshPromise) return refreshPromise;
    const token = ++generation;
    refreshPromise = (async () => {
      try {
        const next = await request('/api/state');
        if (token === generation) {
          apply(next);
          online = true;
          error = '';
        }
      } catch (e) {
        if (token === generation) {
          online = false;
          error = e.message;
        }
      } finally {
        refreshPromise = null;
        announce();
      }
    })();
    return refreshPromise;
  }
  async function submit(payload) {
    return request('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  async function recover() {
    if (!outstanding || busy || !navigator.onLine) return;
    busy = true;
    announce();
    try {
      // Si ritenta solo il comando già emesso, con lo stesso ID: mai nuove modifiche offline.
      const reply = await submit(outstanding);
      outstanding = null;
      apply(reply.state);
      online = true;
      error = '';
    } catch (e) {
      error = e.message;
      if (e.status && e.status < 500) {
        outstanding = null;
        App.toast(e.message);
      }
      online = false;
    } finally {
      busy = false;
      announce();
    }
    if (!outstanding) await refresh();
  }
  async function command(operation, input = {}, expected = revisions()) {
    if (!online || busy || outstanding) {
      App.toast('Modifica non inviata: attendi la connessione e il completamento del salvataggio.');
      restoreViews();
      return null;
    }
    const route = location.hash;
    const requestId =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'r_' +
          Date.now().toString(36) +
          '_' +
          Array.from(crypto.getRandomValues(new Uint32Array(4))).join('_');
    const payload = { id: requestId, operation, input: copy(input), expected: copy(expected) };
    ++generation;
    busy = true;
    error = '';
    announce();
    let result = null;
    try {
      const reply = await submit(payload);
      apply(reply.state);
      online = true;
      result = reply.result;
    } catch (e) {
      error = e.message;
      if (!e.status || e.status >= 500) {
        outstanding = payload;
        online = false;
        App.toast(
          'Conferma non ricevuta. Verifico il salvataggio prima di consentire altre modifiche.',
        );
      } else {
        App.toast(e.message);
      }
    } finally {
      busy = false;
      announce();
    }
    if (!outstanding) {
      await refreshPromise;
      await refresh();
    }
    if (!result) restoreViews();
    return route === location.hash ? result : null;
  }
  function disconnect() {
    online = false;
    announce();
  }
  return {
    KEYS: DOC_KEYS,
    get: (key) => copy(snapshot?.documents[key]?.value),
    get computed() {
      return copy(snapshot?.computed) || {};
    },
    revisions,
    documentError: (key) => snapshot?.documents[key]?.error || '',
    refresh,
    command,
    recover,
    disconnect,
    get ready() {
      return !!snapshot;
    },
    get writable() {
      return online && !busy && !outstanding;
    },
    get status() {
      return status();
    },
    get error() {
      return error;
    },
  };
})();
if (typeof window !== 'undefined') window.DS = DS;
