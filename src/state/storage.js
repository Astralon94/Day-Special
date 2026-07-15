/**
 * Day Special – Shared Storage Layer
 *
 * Schema localStorage:
 *   ds_invitati  → { sposo, sposa, comuni }  (gruppi e invitati)
 *   ds_prices    → { adulto, adultoMenu, bambino, neonato }
 *   ds_budget    → { totale, voci }
 *   ds_fornitori → { fornitori }
 *   ds_programma → { data, eventi, eventOrder }
 *   ds_tavoli    → { tavoli, tableOrder }
 *   ds_checklist → { items }
 *   ds_meta      → { <chiave>: ISO timestamp ultima modifica }  (per la sync)
 *   ds_last_saved → ISO string
 *   ds_base      → { <chiave>: ultimo stato concordato col server }  (LOCALE,
 *                   non sincronizzato: oracolo per il merge a 3 vie in sync.js)
 *
 * Eventi: ogni modifica emette 'ds:change' con detail { key, remote }.
 *   remote=false → modifica locale (questa pagina)
 *   remote=true  → modifica arrivata da un'altra tab o dal server (sync.js)
 *
 * Export e import gestiscono l'intero payload in un unico file.
 */
import { DOC_KEYS } from '../shared/docKeys.js';

export const DS = (() => {

  const KEYS = DOC_KEYS;
  const META_KEY = 'ds_meta';

  // ── Read / Write singola chiave ──────────────────────────────────────────
  function get(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch(e) { console.warn('DS.get error', key, e); return null; }
  }

  function getMeta() {
    try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; }
    catch(e) { return {}; }
  }
  function _setMeta(key, ts) {
    const m = getMeta();
    m[key] = ts;
    localStorage.setItem(META_KEY, JSON.stringify(m));
  }

  // Ripristina una chiave al valore precedente (o la rimuove se non c'era):
  // usato per il rollback di una scrittura fallita a metà.
  function _restore(k, prev) {
    try { if (prev === null) localStorage.removeItem(k); else localStorage.setItem(k, prev); }
    catch(_) {}
  }
  // Avvisa l'utente (se App è già caricato) di un salvataggio fallito.
  function _notifyError(msg) {
    try { if (typeof window !== 'undefined' && window.App && window.App.toast) window.App.toast('⚠️ ' + msg); }
    catch(_) {}
  }

  function set(key, value) {
    const ts = new Date().toISOString();
    // Snapshot per il rollback: le tre scritture (valore, meta, last_saved)
    // devono restare coerenti. Se una fallisce (es. quota superata) ripristiniamo
    // lo stato precedente invece di lasciare valore e meta disallineati.
    const pV = localStorage.getItem(key);
    const pM = localStorage.getItem(META_KEY);
    const pS = localStorage.getItem('ds_last_saved');
    try {
      localStorage.setItem(key, JSON.stringify(value));
      _setMeta(key, ts);
      localStorage.setItem('ds_last_saved', ts);
    } catch(e) {
      console.warn('DS.set error', key, e);
      _restore(key, pV); _restore(META_KEY, pM); _restore('ds_last_saved', pS);
      _notifyError('Spazio di archiviazione locale pieno: modifica NON salvata.');
      return;
    }
    _dispatchChange(key, false);
  }

  /**
   * Applica un valore arrivato dal server (sync.js) SENZA rimetterlo in coda
   * di push: aggiorna il dato, il timestamp remoto e notifica la pagina.
   */
  function applyRemote(key, value, ts) {
    const pV = localStorage.getItem(key);
    const pM = localStorage.getItem(META_KEY);
    const pS = localStorage.getItem('ds_last_saved');
    try {
      localStorage.setItem(key, JSON.stringify(value));
      _setMeta(key, ts);
      if (!pS || ts > pS) localStorage.setItem('ds_last_saved', ts);
    } catch(e) {
      console.warn('DS.applyRemote error', key, e);
      _restore(key, pV); _restore(META_KEY, pM); _restore('ds_last_saved', pS);
      _notifyError('Spazio di archiviazione locale pieno: aggiornamento dal cloud NON salvato.');
      return;
    }
    _dispatchChange(key, true);
  }

  /**
   * Allinea il timestamp locale con quello AUTOREVOLE del server dopo un push
   * riuscito (il DB decide updated_at). Aggiorna solo il meta e ds_last_saved:
   * NON riscrive il valore e NON emette 'ds:change', quindi non innesca un
   * nuovo push né un re-render. Serve a far coincidere il confronto
   * last-write-wins con l'orologio del server (evita ping-pong da clock skew).
   */
  function setServerMeta(key, ts) {
    try {
      _setMeta(key, ts);
      const last = localStorage.getItem('ds_last_saved');
      if (!last || ts > last) localStorage.setItem('ds_last_saved', ts);
    } catch(e) { console.warn('DS.setServerMeta error', key, e); }
  }

  // ── Base snapshot per il merge a 3 vie ───────────────────────────────────
  // 'ds_base' conserva, per ogni chiave, l'ULTIMO stato concordato col server.
  // È locale (non sincronizzato) e fa da oracolo per distinguere, in un merge,
  // gli elementi AGGIUNTI da quelli CANCELLATI (l'app non ha soft-delete).
  const BASE_KEY = 'ds_base';
  function getBase(key) {
    try { const all = JSON.parse(localStorage.getItem(BASE_KEY)) || {}; return (key in all) ? all[key] : null; }
    catch(e) { return null; }
  }
  function setBase(key, value) {
    try {
      const all = JSON.parse(localStorage.getItem(BASE_KEY)) || {};
      all[key] = value;
      localStorage.setItem(BASE_KEY, JSON.stringify(all));
    } catch(e) { console.warn('DS.setBase error', key, e); }
  }

  // ── Uguaglianza profonda (canonica: chiavi ordinate; array ordinati) ─────
  function _canon(x) {
    if (Array.isArray(x)) return x.map(_canon);
    if (x && typeof x === 'object') {
      const o = {};
      Object.keys(x).sort().forEach(k => { o[k] = _canon(x[k]); });
      return o;
    }
    return x;
  }
  function deepEqual(a, b) { return JSON.stringify(_canon(a)) === JSON.stringify(_canon(b)); }

  // ── Merge a 3 vie generico (base, local, remote) ─────────────────────────
  // Regole:
  //  - oggetti: merge campo per campo;
  //  - array di elementi con `id`: merge per id (add su un lato = tieni;
  //    presente in base ma sparito su un lato = cancellato = rimuovi → niente
  //    resurrezioni; presente in entrambi = merge ricorsivo dell'elemento);
  //  - scalari / array di scalari (ordini, guestIds) / tipi discordi:
  //    last-write-wins deciso da `preferRemote` (dal timestamp di chiave);
  //  - gli array d'ordine (groupOrder/eventOrder/tableOrder) vengono riparati
  //    per contenere esattamente gli id sopravvissuti (il render ne dipende).
  const _ID = 'id';
  const ORDER_PAIRS = { eventOrder: 'eventi', tableOrder: 'tavoli', groupOrder: 'groups' };
  function _isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  // Array di elementi con id. L'array vuoto è ammesso (vacuamente vero): serve
  // per gestire una collezione svuotata da una cancellazione — la decisione di
  // fare id-merge richiede comunque che ALMENO un lato sia non vuoto.
  function _isIdArray(a) { return Array.isArray(a) && a.every(el => _isObj(el) && el[_ID] !== undefined); }

  function merge3(base, local, remote, preferRemote) {
    if (deepEqual(local, remote)) return local;   // nessun conflitto
    if (deepEqual(local, base))   return remote;   // solo il remoto è cambiato
    if (deepEqual(remote, base))  return local;    // solo il locale è cambiato

    // Array di elementi con id → merge per id (almeno un lato non vuoto).
    if (_isIdArray(local) && _isIdArray(remote) && (local.length || remote.length)) {
      const b = Array.isArray(base) ? base : [];
      const idx = arr => { const m = {}; arr.forEach(x => { if (_isObj(x) && x[_ID] !== undefined) m[x[_ID]] = x; }); return m; };
      const lMap = idx(local), rMap = idx(remote), bMap = idx(b);
      const out = [], done = {};
      const emit = id => {
        if (done[id]) return; done[id] = 1;
        const inL = id in lMap, inR = id in rMap, inB = id in bMap;
        if (inL && inR)       out.push(merge3(bMap[id], lMap[id], rMap[id], preferRemote));
        else if (inL && !inR) { if (!inB) out.push(lMap[id]); }   // aggiunto in locale (se era in base → cancellato sul remoto → drop)
        else if (!inL && inR) { if (!inB) out.push(rMap[id]); }   // aggiunto sul remoto (se era in base → cancellato in locale → drop)
      };
      // Ordine: prima il lato "vincente", poi le aggiunte dell'altro.
      const first = preferRemote ? remote : local;
      const second = preferRemote ? local : remote;
      first.forEach(x => emit(x[_ID]));
      second.forEach(x => emit(x[_ID]));
      return out;
    }

    // Oggetti → merge campo per campo.
    if (_isObj(local) && _isObj(remote)) {
      const b = _isObj(base) ? base : {};
      const out = {};
      const keys = {};
      Object.keys(local).forEach(k => { keys[k] = 1; });
      Object.keys(remote).forEach(k => { keys[k] = 1; });
      Object.keys(keys).forEach(k => {
        const inL = k in local, inR = k in remote, inB = k in b;
        if (inL && inR)       out[k] = merge3(b[k], local[k], remote[k], preferRemote);
        else if (inL && !inR) { if (!inB) out[k] = local[k]; }   // campo aggiunto in locale (se era in base → rimosso sul remoto → drop)
        else if (!inL && inR) { if (!inB) out[k] = remote[k]; }  // campo aggiunto sul remoto (se era in base → rimosso in locale → drop)
      });
      // Ripara gli array d'ordine: devono contenere ESATTAMENTE gli id sopravvissuti.
      Object.keys(ORDER_PAIRS).forEach(of => {
        const itemsField = ORDER_PAIRS[of];
        if (Array.isArray(out[of]) && Array.isArray(out[itemsField])) {
          const ids = out[itemsField].filter(x => _isObj(x)).map(x => x[_ID]);
          const idset = {}; ids.forEach(id => { idset[id] = 1; });
          const repaired = out[of].filter(id => idset[id]);
          ids.forEach(id => { if (repaired.indexOf(id) === -1) repaired.push(id); });
          out[of] = repaired;
        }
      });
      return out;
    }

    // Scalari, array di scalari, tipi discordi → last-write-wins.
    return preferRemote ? remote : local;
  }

  // ── Cross-tab sync ───────────────────────────────────────────────────────
  function _dispatchChange(key, remote) {
    window.dispatchEvent(new CustomEvent('ds:change', { detail: { key, remote: !!remote } }));
  }
  // Sync automatica quando un'altra tab/pagina modifica localStorage.
  // Solo le chiavi DATI (KEYS): evita re-render inutili per ds_last_saved,
  // ds_theme, ds_meta, ds_base — che non sono contenuti da mostrare.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
      if (e.key && KEYS.includes(e.key)) {
        _dispatchChange(e.key, true);
      }
    });
  }

  // ── Timestamp ────────────────────────────────────────────────────────────
  function lastSaved() {
    return localStorage.getItem('ds_last_saved') || null;
  }
  function lastSavedLabel() {
    const iso = lastSaved();
    if (!iso) return '';
    const d = new Date(iso);
    return 'Ultima modifica: ' + d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Export tutto ─────────────────────────────────────────────────────────
  function _buildPayload() {
    const payload = { version: 2, exportedAt: new Date().toISOString() };
    KEYS.forEach(k => { const v = get(k); if (v !== null) payload[k] = v; });
    return payload;
  }
  function _hasData() {
    return KEYS.some(k => get(k) !== null);
  }
  function _download(payload, prefix) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = (prefix || 'day-special-') + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportAll() {
    _download(_buildPayload());
  }

  // ── Import tutto ─────────────────────────────────────────────────────────
  function importAll(file, onSuccess, onError) {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const payload = JSON.parse(ev.target.result);
        if (!payload.version) throw new Error('Formato non riconosciuto');
        // Validazione di schema: ogni sezione dati presente deve essere un
        // oggetto valido. Un file malformato ma "versionato" verrebbe altrimenti
        // persistito ciecamente, rompendo il rendering delle pagine.
        KEYS.forEach(k => {
          if (payload[k] === undefined) return;
          if (typeof payload[k] !== 'object' || payload[k] === null) {
            throw new Error('Dati non validi per la sezione ' + k);
          }
        });
        // Backup di sicurezza dello stato attuale PRIMA di sovrascrivere: un
        // import errato o più vecchio cancellerebbe in modo definitivo i dati
        // locali (e li propagherebbe al cloud via last-write-wins).
        if (_hasData()) _download(_buildPayload(), 'day-special-backup-pre-import-');
        KEYS.forEach(k => { if (payload[k] !== undefined) set(k, payload[k]); });
        localStorage.setItem('ds_last_saved', payload.exportedAt || new Date().toISOString());
        if (onSuccess) onSuccess(payload);
      } catch(e) {
        if (onError) onError(e);
      }
    };
    reader.readAsText(file);
  }

  return { get, set, applyRemote, setServerMeta, getBase, setBase, merge3, deepEqual, getMeta, lastSaved, lastSavedLabel, exportAll, importAll, KEYS };
})();

// Retro-compatibilità: le view portano ancora `onclick="..."` che si aspettano
// DS in scope globale (stessa ragione per cui App è esposto in app.js).
if (typeof window !== 'undefined') window.DS = DS;
