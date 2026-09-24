import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Checklist – Day Special';

export const html = `
<style>
  .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .progress-title { font-weight: 700; font-size: 1rem; }
  .progress-pct { font-size: 1.1rem; font-weight: 700; color: var(--accent); }
  .stats-row { display: flex; gap: 20px; margin-top: 10px; flex-wrap: wrap; }
  .stat-pill { font-size: .8rem; padding: 3px 12px; border-radius: 12px; font-weight: 600; }
  .pill-todo { background: var(--border-soft); color: var(--muted); }
  .pill-wip  { background: var(--accent-soft); color: var(--gold-txt); }
  .pill-done { background: var(--success-soft); color: var(--success); }
  .group-section { margin-bottom: 24px; }
  .group-title { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 8px 0 6px; border-bottom: 2px solid var(--border); margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
  .item-list { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 14px; box-shadow: var(--shadow); transition: border-color .15s, opacity .15s; animation: fadeUp .25s ease both; }
  .item.done { opacity: .6; }
  .item.done .item-titolo { text-decoration: line-through; color: var(--muted); }
  .item-check { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--border); cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; transition: all .15s; }
  .item-check.done { background: var(--success); border-color: var(--success); }
  .item-check.wip  { background: var(--warning); border-color: var(--warning); }
  .item-check::after { content: '✓'; color: #fff; font-size: .75rem; display: none; }
  .item-check.done::after { display: block; }
  .item-titolo { flex: 1; font-size: .9rem; font-weight: 500; }
  .item-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .prio-badge { font-size: .7rem; padding: 2px 8px; border-radius: 8px; font-weight: 700; }
  .prio-alta  { background: var(--danger-soft); color: var(--danger); }
  .prio-media { background: var(--accent-soft); color: var(--gold-txt); }
  .prio-bassa { background: var(--success-soft); color: var(--success); }
  .cat-badge { font-size: .7rem; padding: 2px 8px; border-radius: 8px; font-weight: 600; background: var(--border-soft); color: var(--muted); }
  .scadenza-badge { font-size: .72rem; color: var(--muted); }
  .scadenza-badge.past { color: var(--danger); font-weight: 700; }
  .item-note { font-size: .78rem; color: var(--muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item-actions { display: flex; gap: 5px; opacity: 0; transition: opacity .15s; }
  .item:hover .item-actions { opacity: 1; }
  @media (max-width: 600px) {
    .item { flex-wrap: wrap; }
    .item-titolo { flex-basis: calc(100% - 36px); }
    .item-note { max-width: 100%; flex-basis: 100%; white-space: normal; }
    .item-meta { order: 4; }
    .item-actions { order: 5; margin-left: auto; opacity: 1; }
  }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Checklist</h1>
  <div class="header-actions">
    <button class="btn btn-ghost btn-sm" onclick="window.print()" title="Stampa la checklist">🖨 Stampa</button>
    <button class="icon-btn" id="theme-toggle">🌙</button>
  </div>
</header>
<div class="container container--narrow">
  <details class="collapsible">
    <summary>📊 Progresso generale <span class="progress-pct" id="pct" style="margin-left:auto">0%</span></summary>
    <div class="progress-wrap collapse-inner">
      <div class="progress-bar"><div class="progress-fill" id="bar-fill" style="width:0%"></div></div>
      <div class="stats-row">
        <span class="stat-pill pill-todo" id="s-todo">0 da fare</span>
        <span class="stat-pill pill-wip"  id="s-wip">0 in corso</span>
        <span class="stat-pill pill-done" id="s-done">0 completate</span>
      </div>
    </div>
  </details>
  <div class="toolbar">
    <button class="btn btn-primary" onclick="openForm()">+ Aggiungi attività</button>
    <input class="search-input" type="text" id="search" placeholder="Cerca attività..." oninput="renderList()" />
    <select class="filter-select" id="filter-cat" onchange="renderList()"><option value="">Tutte le categorie</option></select>
    <select class="filter-select" id="filter-prio" onchange="renderList()">
      <option value="">Tutte le priorità</option>
      <option value="alta">Alta</option>
      <option value="media">Media</option>
      <option value="bassa">Bassa</option>
    </select>
    <select class="filter-select" id="filter-stato" onchange="renderList()">
      <option value="">Tutti gli stati</option>
      <option value="todo">Da fare</option>
      <option value="wip">In corso</option>
      <option value="done">Completate</option>
    </select>
    <select class="filter-select" id="sort-by" onchange="renderList()" title="Ordinamento all'interno di ogni fase">
      <option value="manuale">Ordine di inserimento</option>
      <option value="priorita">Per priorità</option>
      <option value="scadenza">Per scadenza</option>
    </select>
    <button class="btn btn-ghost" onclick="addDefaults()">📋 Template base</button>
  </div>
  <div class="add-form" id="add-form">
    <h3 id="form-title">Nuova attività</h3>
    <div class="form-grid">
      <div class="form-group full"><label>Titolo *</label><input type="text" id="f-titolo" placeholder="Es. Prenotare la chiesa" /></div>
      <div class="form-group">
        <label>Fase temporale</label>
        <select id="f-fase">
          <option value="10/12 mesi prima">10/12 mesi prima</option>
          <option value="7/9 mesi prima">7/9 mesi prima</option>
          <option value="4/6 mesi prima">4/6 mesi prima</option>
          <option value="2/3 mesi prima">2/3 mesi prima</option>
          <option value="1 mese prima">1 mese prima</option>
          <option value="2 settimane prima">2 settimane prima</option>
          <option value="L'ultima settimana">L'ultima settimana</option>
          <option value="L'ultimo giorno">L'ultimo giorno</option>
          <option value="Dopo il matrimonio">Dopo il matrimonio</option>
        </select>
      </div>
      <div class="form-group">
        <label>Categoria</label>
        <select id="f-categoria">
          <option>Pianificazione</option><option>Cerimonia</option><option>Banchetto</option>
          <option>Fotografia e video</option><option>Musica</option><option>Partecipazioni</option>
          <option>Luna di miele</option><option>Sposa e accessori</option><option>Sposo e accessori</option>
          <option>Fiori e decorazioni</option><option>Bomboniere</option><option>Gioielleria</option>
          <option>Bellezza e benessere</option><option>Trasporti</option><option>Pratiche burocratiche</option>
          <option>Lista nozze</option><option>Altro</option>
        </select>
      </div>
      <div class="form-group">
        <label>Priorità</label>
        <select id="f-priorita">
          <option value="alta">Alta</option>
          <option value="media" selected>Media</option>
          <option value="bassa">Bassa</option>
        </select>
      </div>
      <div class="form-group">
        <label>Stato</label>
        <select id="f-stato">
          <option value="todo">Da fare</option>
          <option value="wip">In corso</option>
          <option value="done">Completata</option>
        </select>
      </div>
      <div class="form-group"><label>Scadenza</label><input type="date" id="f-scadenza" /></div>
      <div class="form-group full"><label>Note</label><textarea id="f-note" placeholder="Dettagli, contatti, link..."></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveItem()">Salva</button>
      <button class="btn btn-ghost" onclick="closeForm()">Annulla</button>
    </div>
  </div>
  <div id="list-wrap"></div>
</div>
<div id="toast"></div>
`;

// Checklist precompilata: 98 attività ordinate per fase temporale (dal più lontano al post-nozze).


export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const { uid, esc, toast } = App;

  let data = { items: [] };
  let editId = null;
  let editExpected = null;


  function load() { data = DS.get('ds_checklist') || { items: [] }; }

  function updateProgress() {
    const all  = data.items.length;
    const done = data.items.filter(i => i.stato === 'done').length;
    const wip  = data.items.filter(i => i.stato === 'wip').length;
    const todo = all - done - wip;
    const pct  = all > 0 ? Math.round((done/all)*100) : 0;
    $('#pct').textContent      = pct + '%';
    $('#bar-fill').style.width = pct + '%';
    $('#s-todo').textContent   = todo + ' da fare';
    $('#s-wip').textContent    = wip  + ' in corso';
    $('#s-done').textContent   = done + ' completate';
  }

  function refreshFilters() {
    const cats = [...new Set(data.items.map(i => i.categoria))].sort();
    const sel = $('#filter-cat');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tutte le categorie</option>';
    cats.forEach(c => { const o = document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
    sel.value = cur;
  }

  const PRIO_ORDER = { alta: 0, media: 1, bassa: 2 };
  const PHASE_ORDER = [
    '10/12 mesi prima', '7/9 mesi prima', '4/6 mesi prima', '2/3 mesi prima',
    '1 mese prima', '2 settimane prima', "L'ultima settimana", "L'ultimo giorno", 'Dopo il matrimonio'
  ];
  const SENZA_FASE = 'Senza fase';
  function phaseRank(f) { const i = PHASE_ORDER.indexOf(f); return i < 0 ? PHASE_ORDER.length : i; }

  function sortItems(list) {
    const mode = $('#sort-by').value;
    if (mode === 'priorita') {
      return [...list].sort((a, b) => (PRIO_ORDER[a.priorita] ?? 9) - (PRIO_ORDER[b.priorita] ?? 9));
    }
    if (mode === 'scadenza') {
      return [...list].sort((a, b) => (a.scadenza || '9999') < (b.scadenza || '9999') ? -1 : 1);
    }
    return list;
  }

  function renderList() {
    const q      = ($('#search').value||'').toLowerCase();
    const catF   = $('#filter-cat').value;
    const prioF  = $('#filter-prio').value;
    const statoF = $('#filter-stato').value;

    let items = data.items;
    if (q)      items = items.filter(i => i.titolo.toLowerCase().includes(q) || (i.note||'').toLowerCase().includes(q));
    if (catF)   items = items.filter(i => i.categoria === catF);
    if (prioF)  items = items.filter(i => i.priorita === prioF);
    if (statoF) items = items.filter(i => i.stato === statoF);

    const wrap = $('#list-wrap');
    if (!items.length) {
      wrap.innerHTML = '<div class="empty-state">Nessuna attività trovata. Clicca "+ Aggiungi attività" per iniziare.</div>';
      refreshFilters(); updateProgress(); return;
    }

    const groups = {};
    items.forEach(i => { const f = i.fase || SENZA_FASE; (groups[f] = groups[f] || []).push(i); });

    wrap.innerHTML = '';
    Object.entries(groups)
      .sort(([a],[b]) => phaseRank(a) - phaseRank(b))
      .forEach(([fase, list]) => {
        const sec = document.createElement('div');
        sec.className = 'group-section';
        const doneInPhase = list.filter(i => i.stato === 'done').length;
        sec.innerHTML = `<div class="group-title"><span>${esc(fase)}</span><span style="font-weight:400">${doneInPhase}/${list.length}</span></div><div class="item-list"></div>`;
        wrap.appendChild(sec);
        const ul = sec.querySelector('.item-list');
        sortItems(list).forEach(item => ul.appendChild(buildItem(item)));
      });

    refreshFilters(); updateProgress();
  }

  function buildItem(item) {
    const div = document.createElement('div');
    div.className = 'item' + (item.stato === 'done' ? ' done' : '');
    div.dataset.iid = item.id;

    const today = new Date().toISOString().slice(0,10);
    const past  = item.scadenza && item.scadenza < today && item.stato !== 'done';
    const scadHtml = item.scadenza
      ? `<span class="scadenza-badge${past?' past':''}">📅 ${item.scadenza}</span>` : '';

    div.innerHTML = `
      <div class="item-check ${item.stato==='done'?'done':item.stato==='wip'?'wip':''}" onclick="cycleStato('${item.id}',this)" title="Clicca per cambiare stato"></div>
      <div class="item-titolo">${esc(item.titolo)}</div>
      <div class="item-meta">
        ${item.categoria ? `<span class="cat-badge">${esc(item.categoria)}</span>` : ''}
        <span class="prio-badge prio-${esc(item.priorita)}">${esc(item.priorita)}</span>
        ${scadHtml}
      </div>
      ${item.note ? `<div class="item-note" title="${esc(item.note)}">${esc(item.note)}</div>` : ''}
      <div class="item-actions">
        <button class="btn btn-sm btn-ghost" onclick="editItem('${item.id}')">✏️</button>
        <button class="btn btn-sm btn-danger" onclick="deleteItem('${item.id}')">✕</button>
      </div>`;
    return div;
  }

  async function cycleStato(id) { await DS.command('task.cycle', { id }); }

  function openForm(idata) {
    editExpected = DS.revisions();
    editId = idata ? idata.id : null;
    $('#form-title').textContent = editId ? 'Modifica attività' : 'Nuova attività';
    $('#f-titolo').value    = idata?.titolo    || '';
    $('#f-fase').value      = idata?.fase      || '10/12 mesi prima';
    $('#f-categoria').value = idata?.categoria || 'Altro';
    $('#f-priorita').value  = idata?.priorita  || 'media';
    $('#f-stato').value     = idata?.stato     || 'todo';
    $('#f-scadenza').value  = idata?.scadenza  || '';
    $('#f-note').value      = idata?.note      || '';
    $('#add-form').classList.add('open');
    $('#f-titolo').focus();
  }
  function closeForm() { $('#add-form').classList.remove('open'); editId = null; }

  async function saveItem() {
    const titolo = $('#f-titolo').value.trim();
    if (!titolo) { toast('Inserisci il titolo'); return; }
    const wasEdit = !!editId;
    const obj = {
      id:        editId,
      titolo,
      fase:      $('#f-fase').value,
      categoria: $('#f-categoria').value,
      priorita:  $('#f-priorita').value,
      stato:     $('#f-stato').value,
      scadenza:  $('#f-scadenza').value,
      note:      $('#f-note').value.trim()
    };
    const { id, ...values } = obj;
    if (!await DS.command('task.save', { id: editId, values }, editExpected)) return;
    closeForm(); toast(wasEdit ? 'Modifica salvata' : 'Elemento aggiunto');
  }
  function editItem(id) { openForm(data.items.find(i => i.id === id)); }
  async function deleteItem(id) {
    if (!confirm('Eliminare questo elemento?')) return;
    if (await DS.command('task.delete', { id })) toast('Elemento eliminato');
  }

  async function addDefaults() {
    if (!confirm('Aggiungere le attività mancanti del template?')) return;
    const result = await DS.command('task.template');
    if (result) toast(result.added + ' attività aggiunte');
  }

  Object.assign(window, { openForm, closeForm, saveItem, editItem, deleteItem, cycleStato, addDefaults, renderList });

  load(); renderList();
  const onChange = e => { if (e.detail.remote && e.detail.key === 'ds_checklist') { load(); renderList(); } };
  window.addEventListener('ds:change', onChange);
  return () => {
    window.removeEventListener('ds:change', onChange);
  };
}
