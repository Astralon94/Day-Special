import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Day Special – Home';

export const html = `
<style>
  body { display: flex; flex-direction: column; }
  .logo { font-family: var(--font-serif); font-size: 1.6rem; font-weight: 700; letter-spacing: .01em; }
  .logo span { color: var(--accent); }
  .logo-sub { font-size: .85rem; color: var(--muted); margin-top: 2px; }
  .hero { text-align: center; padding: 52px 24px 36px; }
  .hero h2 { font-family: var(--font-serif); font-size: 2.1rem; font-weight: 700; margin-bottom: 10px; }
  .hero p { color: var(--muted); font-size: 1rem; max-width: 480px; margin: 0 auto; }
  .countdown {
    display: inline-flex; align-items: baseline; gap: 8px; margin-top: 18px;
    background: var(--accent-soft); border: 1px solid var(--accent-line);
    border-radius: 999px; padding: 8px 22px; animation: fadeUp .4s ease both;
  }
  .countdown .num { font-family: var(--font-serif); font-size: 1.6rem; font-weight: 700; color: var(--gold-txt); font-variant-numeric: tabular-nums; }
  .countdown .txt { font-size: .85rem; color: var(--gold-txt); }
  .dash { max-width: 960px; margin: 0 auto 36px; padding: 0 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; }
  .dash-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px 18px; animation: fadeUp .35s ease both; }
  .dash-card .d-lbl { font-size: .72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 6px; }
  .dash-card .d-val { font-size: 1.45rem; font-weight: 700; color: var(--accent); line-height: 1.2; font-variant-numeric: tabular-nums; }
  .dash-card .d-sub { font-size: .78rem; color: var(--muted); margin-top: 4px; }
  .dash-bar { height: 6px; background: var(--border-soft); border-radius: 3px; margin-top: 10px; overflow: hidden; }
  .dash-bar > div { height: 100%; background: var(--accent); border-radius: 3px; transition: width .4s; }
  .dash-bar > div.over { background: var(--danger); }
  .sections { max-width: 960px; margin: 0 auto; padding: 0 24px 60px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
  .section-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 26px 24px 20px; text-decoration: none; color: var(--text);
    display: flex; flex-direction: column; gap: 10px;
    transition: box-shadow .18s, border-color .18s, transform .18s;
    animation: fadeUp .35s ease both;
  }
  .section-card:hover { box-shadow: var(--shadow-lg); border-color: var(--accent); transform: translateY(-3px); }
  .card-icon { font-size: 2.1rem; line-height: 1; }
  .card-title { font-family: var(--font-serif); font-size: 1.15rem; font-weight: 700; }
  .card-desc { font-size: .85rem; color: var(--muted); line-height: 1.5; flex: 1; }
  .card-stat { font-size: .8rem; font-weight: 600; color: var(--accent-dk); background: var(--accent-soft); border: 1px solid var(--accent-line); border-radius: 10px; padding: 3px 12px; width: fit-content; }
  [data-theme="dark"] .card-stat { color: var(--accent); }
  footer { margin-top: auto; text-align: center; padding: 20px; font-size: .8rem; color: var(--muted); border-top: 1px solid var(--border); background: var(--surface); }
  @media (max-width: 600px) {
    .logo { font-size: 1.4rem; }
    .hero { padding: 32px 18px 24px; }
    .hero h2 { font-size: 1.6rem; }
    .hero p { font-size: .92rem; }
    .countdown { padding: 8px 16px; margin-top: 14px; }
    .countdown .num { font-size: 1.3rem; }
    .dash { padding: 0 14px; gap: 12px; grid-template-columns: 1fr 1fr; }
    .dash-card { padding: 14px 14px; }
    .dash-card .d-val { font-size: 1.3rem; }
    .sections { padding: 0 14px 40px; gap: 14px; grid-template-columns: 1fr; }
    .section-card { padding: 20px 18px 16px; }
  }
</style>

<header>
  <div>
    <div class="logo">Day <span>Special</span></div>
  </div>
  <div class="header-actions">
    <button class="icon-btn" id="theme-toggle" title="Tema chiaro/scuro">🌙</button>
  </div>
</header>

<div class="hero">
  <h2>Benvenuto nel tuo planner 💍</h2>
  <div class="countdown" id="countdown" style="display:none">
    <span class="num" id="cd-num"></span>
    <span class="txt" id="cd-txt"></span>
  </div>
</div>

<div class="dash" id="dash"></div>

<div class="sections">
  <a class="section-card" href="#/invitati">
    <div class="card-icon">👥</div>
    <div class="card-title">Invitati</div>
    <div class="card-desc">Gestisci la lista degli invitati, i gruppi famiglia, gli stati degli inviti e il costo del menù.</div>
    <div class="card-stat" id="stat-invitati">—</div>
  </a>
  <a class="section-card" href="#/budget">
    <div class="card-icon">💰</div>
    <div class="card-title">Budget</div>
    <div class="card-desc">Tieni traccia delle spese per categoria, lo stato dei pagamenti e il saldo disponibile.</div>
    <div class="card-stat" id="stat-budget">—</div>
  </a>
  <a class="section-card" href="#/fornitori">
    <div class="card-icon">📋</div>
    <div class="card-title">Fornitori</div>
    <div class="card-desc">Gestisci contatti, preventivi e stato del contratto di fotografi, catering, fioristi e altri fornitori.</div>
    <div class="card-stat" id="stat-fornitori">—</div>
  </a>
  <a class="section-card" href="#/programma">
    <div class="card-icon">🗓️</div>
    <div class="card-title">Programma</div>
    <div class="card-desc">Costruisci la timeline della giornata con eventi, orari, luoghi e note. Riordinabile con drag & drop.</div>
    <div class="card-stat" id="stat-programma">—</div>
  </a>
  <a class="section-card" href="#/tavoli">
    <div class="card-icon">🪑</div>
    <div class="card-title">Tavoli</div>
    <div class="card-desc">Crea i tavoli e assegna gli ospiti confermati con drag & drop. Si sincronizza con la lista invitati.</div>
    <div class="card-stat" id="stat-tavoli">—</div>
  </a>
  <a class="section-card" href="#/checklist">
    <div class="card-icon">✅</div>
    <div class="card-title">Checklist</div>
    <div class="card-desc">Tutte le attività ordinate per fase temporale, dai 12 mesi prima al dopo-nozze. Già precompilata e con aggiunta, modifica ed eliminazione libere.</div>
    <div class="card-stat" id="stat-checklist">—</div>
  </a>
  <a class="section-card" href="#/impostazioni">
    <div class="card-icon">⚙️</div>
    <div class="card-title">Impostazioni</div>
    <div class="card-desc">Versione dell'app e aggiornamento software.</div>
    <div class="card-stat" id="stat-impostazioni">—</div>
  </a>
</div>

<footer>
  <div>Day Special</div>
  <div style="margin-top:4px">Sviluppato con ❤️ da Francesco Maria De Santis</div>
</footer>
<div id="toast"></div>
`;

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);

  function allGuests() {
    const inv = DS.get('ds_invitati');
    if (!inv) return [];
    const out = [];
    if (inv.sposi && inv.sposi.guests) inv.sposi.guests.forEach(guest => out.push(guest));
    ['sposo', 'sposa', 'comuni'].forEach(sec => {
      if (!inv[sec] || !inv[sec].groups) return;
      inv[sec].groups.forEach(g => g.guests.forEach(guest => out.push(guest)));
    });
    return out;
  }

  function renderCountdown() {
    const prog = DS.get('ds_programma');
    const box  = $('#countdown');
    if (!prog || !prog.data) { box.style.display = 'none'; return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const day   = new Date(prog.data + 'T00:00:00');
    const diff  = Math.round((day - today) / 86400000);
    const num = $('#cd-num');
    const txt = $('#cd-txt');
    const dateLabel = day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (diff > 0)       { num.textContent = diff; txt.textContent = (diff === 1 ? 'giorno' : 'giorni') + ' al matrimonio · ' + dateLabel; }
    else if (diff === 0){ num.textContent = '🎉'; txt.textContent = 'È oggi! Auguri!'; }
    else                { num.textContent = '💞'; txt.textContent = 'Sposati il ' + dateLabel; }
    box.style.display = 'inline-flex';
  }

  function dashCard(lbl, val, sub, pct, over) {
    return `<div class="dash-card">
      <div class="d-lbl">${lbl}</div>
      <div class="d-val">${val}</div>
      ${sub ? `<div class="d-sub">${sub}</div>` : ''}
      ${pct !== undefined ? `<div class="dash-bar"><div style="width:${Math.min(pct, 100)}%" class="${over ? 'over' : ''}"></div></div>` : ''}
    </div>`;
  }

  function renderDashboard() {
    renderCountdown();
    const cards = [];

    const guests = allGuests();
    const reali  = guests.filter(g => !g.formale);
    const conf   = reali.filter(g => g.status === 'confermato').length;
    if (guests.length) {
      cards.push(dashCard('👥 Invitati', reali.length, conf + ' confermati', reali.length ? (conf / reali.length) * 100 : 0));
      $('#stat-invitati').textContent = `${reali.length} invitati · ${conf} confermati`;
    } else {
      $('#stat-invitati').textContent = 'Inizia da qui';
    }

    const b = DS.get('ds_budget');
    if (b && (b.totale || (b.voci || []).length)) {
      const prev = (b.voci || []).reduce((s, v) => s + (v.preventivo || 0), 0);
      const pag  = (b.voci || []).reduce((s, v) => s + (v.pagato || 0), 0);
      const pct  = b.totale > 0 ? (prev / b.totale) * 100 : 0;
      cards.push(dashCard('💰 Budget', App.fmtEur(b.totale), App.fmtEur(prev) + ' preventivato · ' + App.fmtEur(pag) + ' pagato', pct, prev > b.totale && b.totale > 0));
      $('#stat-budget').textContent = `${App.fmtEur(pag)} / ${App.fmtEur(b.totale)}`;
    } else {
      $('#stat-budget').textContent = 'Da impostare';
    }

    const c = DS.get('ds_checklist');
    if (c && (c.items || []).length) {
      const done = c.items.filter(i => i.stato === 'done').length;
      const pct  = Math.round((done / c.items.length) * 100);
      cards.push(dashCard('✅ Checklist', pct + '%', done + ' su ' + c.items.length + ' completate', pct));
      $('#stat-checklist').textContent = `${done}/${c.items.length} attività`;
    } else {
      $('#stat-checklist').textContent = 'Nessuna attività';
    }

    const t = DS.get('ds_tavoli');
    if (t && (t.tavoli || []).length) {
      const posti = t.tavoli.reduce((s, x) => s + (x.posti || 0), 0);
      const ass   = t.tavoli.reduce((s, x) => s + (x.guestIds || []).length, 0);
      cards.push(dashCard('🪑 Tavoli', t.tavoli.length, ass + ' / ' + posti + ' posti assegnati', posti ? (ass / posti) * 100 : 0));
      $('#stat-tavoli').textContent = `${t.tavoli.length} tavoli · ${ass} assegnati`;
    } else {
      $('#stat-tavoli').textContent = 'Nessun tavolo';
    }

    const f = DS.get('ds_fornitori');
    if (f && (f.fornitori || []).length) {
      const firmati = f.fornitori.filter(x => x.stato === 'contratto' || x.stato === 'saldato').length;
      $('#stat-fornitori').textContent = `${f.fornitori.length} fornitori · ${firmati} contratti`;
    } else {
      $('#stat-fornitori').textContent = 'Nessun fornitore';
    }

    const p = DS.get('ds_programma');
    if (p && (p.eventi || []).length) {
      $('#stat-programma').textContent = `${p.eventi.length} eventi in timeline`;
    } else {
      $('#stat-programma').textContent = 'Timeline vuota';
    }

    $('#dash').innerHTML = cards.join('');
  }

  async function loadUpdateStat() {
    const el = $('#stat-impostazioni');
    try {
      const res = await fetch('/api/updates');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const s = await res.json();
      el.textContent = s.disponibile ? `🔔 Aggiornamento v${s.ultima} disponibile` : `v${s.corrente} · aggiornato`;
    } catch (e) {
      el.textContent = 'v? · stato non disponibile';
    }
  }

  renderDashboard();
  loadUpdateStat();
  const onChange = () => renderDashboard();
  window.addEventListener('ds:change', onChange);
  return () => window.removeEventListener('ds:change', onChange);
}
