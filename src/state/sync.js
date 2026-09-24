// SSE invalida la cache; il browser rilegge sempre lo stato autorevole dal server.
import { DS } from './storage.js';
export const Sync = (() => {
  let started = false,
    stream = null;
  const labels = {
    connecting: 'Caricamento dati dal server…',
    offline: 'Sola lettura — server non raggiungibile',
    saving: 'Salvataggio sul server…',
    uncertain: 'Verifica del salvataggio in corso — non chiudere la pagina',
    synced: 'Salvato sul server',
  };
  function showStatus() {
    const badge = document.getElementById('sync-status');
    if (badge) badge.textContent = labels[DS.status];
    let notice = document.getElementById('server-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'server-notice';
      document.body.prepend(notice);
    }
    notice.textContent = labels[DS.status];
    notice.hidden = DS.status === 'synced';
    document.documentElement.dataset.readonly = String(!DS.writable);
  }
  function allowed(target) {
    return (
      target.closest(
        'a, #theme-toggle, #btn-print, #btn-csv, [data-readonly-action], .menu-toggle, [onclick^=switchTab], [onclick^=toggleGroupCollapse], [onclick^=toggleCollapseAll], [id^=filter-], #search-unassigned, #search, #sort-by, summary',
      ) || target.closest('button')?.textContent.match(/Stampa|CSV|Esporta|Annulla|Chiudi/)
    );
  }
  function guard(e) {
    if (DS.writable || allowed(e.target) || !e.target.closest('#app')) return;
    if (e.target.closest('input,select,textarea,button,[onclick],[draggable],#room-viewport')) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }
  async function refresh() {
    await DS.recover();
    await DS.refresh();
    showStatus();
  }
  function init() {
    if (started) return;
    started = true;
    for (const event of [
      'click',
      'beforeinput',
      'keydown',
      'change',
      'pointerdown',
      'dragstart',
      'drop',
    ])
      document.addEventListener(event, guard, true);
    window.addEventListener('ds:status', showStatus);
    window.addEventListener('offline', () => {
      DS.disconnect();
      showStatus();
    });
    window.addEventListener('online', refresh);
    window.addEventListener('beforeunload', (e) => {
      if (['saving', 'uncertain'].includes(DS.status)) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    stream = new EventSource('/api/stream');
    stream.onopen = refresh;
    stream.addEventListener('invalidate', refresh);
    stream.onerror = () => {
      DS.disconnect();
      showStatus();
    };
    setInterval(refresh, 15000);
    refresh();
  }
  function onViewMounted() {
    const header = document.querySelector('.header-actions');
    if (header && !document.getElementById('sync-status')) {
      const span = document.createElement('span');
      span.id = 'sync-status';
      span.className = 'save-badge';
      header.prepend(span);
    }
    showStatus();
  }
  return {
    init,
    onViewMounted,
    get status() {
      return DS.status;
    },
  };
})();
if (typeof window !== 'undefined') window.Sync = Sync;
