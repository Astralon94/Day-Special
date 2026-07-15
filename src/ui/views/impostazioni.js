import { App } from '../app.js';

export const title = 'Impostazioni – Day Special';

export const html = `
<style>
  .set-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 24px; max-width: 560px; margin: 0 auto 20px;
  }
  .set-card h2 { font-size: 1.05rem; font-weight: 700; margin-bottom: 4px; }
  .set-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-soft); }
  .set-row:last-of-type { border-bottom: none; }
  .set-lbl { font-size: .88rem; color: var(--muted); }
  .set-val { font-size: .92rem; font-weight: 600; }
  .set-val.ok { color: var(--success); }
  .set-val.new { color: var(--gold-txt); }
  .set-note { font-size: .82rem; color: var(--muted); margin-top: 10px; line-height: 1.5; }
  .set-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .set-msg { font-size: .85rem; margin-top: 12px; padding: 10px 12px; border-radius: 8px; display: none; }
  .set-msg.show { display: block; }
  .set-msg.info    { background: var(--accent-soft); color: var(--gold-txt); }
  .set-msg.error   { background: var(--danger-soft); color: var(--danger); }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Impostazioni</h1>
  <div class="header-actions">
    <button class="icon-btn" id="theme-toggle">🌙</button>
  </div>
</header>
<div class="container container--narrow">
  <div class="set-card">
    <h2>🔄 Aggiornamento software</h2>
    <div class="set-row">
      <span class="set-lbl">Versione installata</span>
      <span class="set-val" id="s-corrente">—</span>
    </div>
    <div class="set-row">
      <span class="set-lbl">Stato</span>
      <span class="set-val" id="s-stato">—</span>
    </div>
    <div class="set-row">
      <span class="set-lbl">Ultimo controllo</span>
      <span class="set-val" id="s-ultimo-check">—</span>
    </div>
    <div class="set-note" id="s-note" style="display:none"></div>
    <div class="set-actions">
      <button class="btn btn-ghost" id="btn-check">Controlla aggiornamenti</button>
      <button class="btn btn-primary" id="btn-install" style="display:none">Installa aggiornamento</button>
    </div>
    <div class="set-msg" id="s-msg"></div>
  </div>
</div>
<div id="toast"></div>
`;

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  let installing = false;

  function showMsg(text, type) {
    const el = $('#s-msg');
    el.textContent = text;
    el.className = 'set-msg show ' + (type || 'info');
  }
  function hideMsg() {
    $('#s-msg').className = 'set-msg';
  }

  function render(s) {
    $('#s-corrente').textContent = 'v' + s.corrente;
    if (s.disponibile) {
      $('#s-stato').textContent = 'Nuova versione v' + s.ultima + ' disponibile';
      $('#s-stato').className = 'set-val new';
      $('#btn-install').style.display = '';
    } else {
      $('#s-stato').textContent = 'Sei aggiornato/a';
      $('#s-stato').className = 'set-val ok';
      $('#btn-install').style.display = 'none';
    }
    $('#s-ultimo-check').textContent = s.controllato_il
      ? new Date(s.controllato_il).toLocaleString('it-IT')
      : 'mai';
    const note = $('#s-note');
    if (s.disponibile && s.note) {
      note.textContent = 'Note della versione ' + s.ultima + ': ' + s.note;
      note.style.display = '';
    } else {
      note.style.display = 'none';
    }
  }

  async function load() {
    try {
      const res = await fetch('/api/updates');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      render(await res.json());
    } catch (e) {
      showMsg('Impossibile leggere lo stato aggiornamenti: ' + e.message, 'error');
    }
  }

  async function checkNow() {
    if (installing) return;
    const btn = $('#btn-check');
    btn.disabled = true;
    hideMsg();
    try {
      const res = await fetch('/api/updates/check', { method: 'POST' });
      const s = await res.json();
      if (!res.ok) throw new Error(s.error || ('HTTP ' + res.status));
      render(s);
      App.toast(s.disponibile ? '🔔 Nuova versione disponibile: v' + s.ultima : '✓ Sei già aggiornato/a');
    } catch (e) {
      showMsg('Controllo non riuscito: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  }

  async function installNow() {
    if (installing) return;
    const versioneNote = $('#s-stato').textContent;
    if (!confirm('Installare l\'aggiornamento (' + versioneNote + ')? Il server si riavvia da solo: per qualche secondo l\'app potrebbe non rispondere, poi la pagina si ricaricherà da sola.')) return;
    installing = true;
    $('#btn-install').disabled = true;
    $('#btn-check').disabled = true;
    showMsg('⬇️ Download e installazione in corso…', 'info');
    try {
      const res = await fetch('/api/updates/install', { method: 'POST' });
      const s = await res.json();
      if (!res.ok) throw new Error(s.error || ('HTTP ' + res.status));
      showMsg('🔄 Aggiornamento installato: il server si sta riavviando… la pagina si ricaricherà automaticamente.', 'info');
      waitForRestart();
    } catch (e) {
      showMsg('Installazione non riuscita: ' + e.message, 'error');
      installing = false;
      $('#btn-install').disabled = false;
      $('#btn-check').disabled = false;
    }
  }

  // Il server esce con codice 42 dopo l'installazione: il supervisore (systemd
  // in produzione, avvia-dev.sh in sviluppo) lo rialza da solo sul codice
  // nuovo. Qui aspettiamo che torni a rispondere prima di ricaricare, così
  // il browser prende sempre il bundle aggiornato (mai una vecchia cache).
  function waitForRestart() {
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (res.ok) { clearInterval(poll); location.reload(); }
      } catch (e) { /* server ancora giù: riprova */ }
      if (tries > 40) { clearInterval(poll); showMsg('Il server non risponde ancora: prova a ricaricare la pagina manualmente tra poco.', 'error'); }
    }, 1500);
  }

  $('#btn-check').addEventListener('click', checkNow);
  $('#btn-install').addEventListener('click', installNow);

  load();
  return null;
}
