import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Programma – Day Special';

export const html = `
<style>
  .date-bar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 24px; margin-bottom: 24px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .date-bar label { font-weight: 600; font-size: .95rem; }
  .date-bar input[type=date] { padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: .95rem; background: var(--surface); color: var(--text); font-family: inherit; }
  .date-bar input[type=date]:focus { outline: none; border-color: var(--accent); }
  .date-bar .data-display { font-size: 1rem; color: var(--accent-dk); font-weight: 700; font-family: var(--font-serif); }
  .timeline { display: flex; flex-direction: column; gap: 0; position: relative; }
  .timeline::before { content:''; position: absolute; left: 70px; top: 0; bottom: 0; width: 2px; background: var(--border); z-index: 0; }
  .event-row { display: flex; gap: 0; align-items: stretch; position: relative; z-index: 1; animation: fadeUp .3s ease both; }
  .event-row.dragging { opacity: .4; }
  .event-row.drop-target { outline: 2px dashed var(--accent); border-radius: var(--radius); }
  .time-col { width: 70px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 16px 0 0; }
  .time-label { font-size: .82rem; font-weight: 700; color: var(--accent-dk); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .time-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--accent); border: 2px solid var(--surface); margin-top: 6px; flex-shrink: 0; }
  .event-card { flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); margin: 8px 0 8px 20px; padding: 14px 16px; box-shadow: var(--shadow); position: relative; transition: border-color .15s; }
  .event-card:hover { border-color: var(--accent); }
  .event-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .event-drag { color: var(--border); cursor: grab; font-size: .9rem; }
  .event-drag:active { cursor: grabbing; }
  .event-cat-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .event-titolo-input { font-weight: 700; font-size: .95rem; flex: 1; border: none; background: transparent; outline: none; border-bottom: 1px dashed var(--accent); color: var(--text); font-family: inherit; }
  .event-cat-badge { font-size: .75rem; padding: 2px 8px; border-radius: 10px; background: var(--border-soft); font-weight: 600; }
  .event-meta { font-size: .82rem; color: var(--muted); display: flex; gap: 12px; flex-wrap: wrap; }
  .event-luogo::before { content: '📍 '; }
  .event-durata::before { content: '⏱ '; }
  .event-note { font-size: .82rem; color: var(--muted); margin-top: 6px; font-style: italic; }
  .event-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; opacity: 0; transition: opacity .15s; }
  .event-card:hover .event-actions { opacity: 1; }
  @media (max-width: 600px) {
    .event-actions { position: static; opacity: 1; justify-content: flex-end; margin-top: 10px; }
    .event-card { margin-left: 14px; }
    .event-meta { gap: 8px; }
  }
  @media print {
    .date-bar input, .event-drag, .event-actions { display: none; }
    .timeline::before { background: #ccc; }
  }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Programma</h1>
  <div class="header-actions">
    <span class="lbl-saved" id="last-saved"></span>
    <button class="btn btn-ghost btn-sm" onclick="window.print()" title="Stampa la timeline">🖨 Stampa</button>
    <button class="icon-btn" id="theme-toggle">🌙</button>
  </div>
</header>
<div class="container container--narrow">
  <details class="collapsible">
    <summary>📅 Data del matrimonio <span class="data-display" id="data-display" style="margin-left:auto;font-size:.9rem"></span></summary>
    <div class="date-bar collapse-inner">
      <label>Data:</label>
      <input type="date" id="input-data" onchange="saveData()" />
    </div>
  </details>
  <div class="toolbar">
    <button class="btn btn-primary" onclick="openForm()">+ Aggiungi evento</button>
    <button class="btn btn-ghost" onclick="sortByTime()">⏰ Ordina per orario</button>
  </div>
  <div class="add-form" id="add-form">
    <h3 id="form-title">Nuovo evento</h3>
    <div class="form-grid">
      <div class="form-group"><label>Orario *</label><input type="time" id="f-ora" /></div>
      <div class="form-group full"><label>Titolo *</label><input type="text" id="f-titolo" placeholder="Es. Cerimonia religiosa" /></div>
      <div class="form-group">
        <label>Categoria</label>
        <select id="f-categoria">
          <option value="Cerimonia">💒 Cerimonia</option>
          <option value="Preparativi">💄 Preparativi</option>
          <option value="Foto">📷 Sessione fotografica</option>
          <option value="Ricevimento">🥂 Ricevimento</option>
          <option value="Trasferimento">🚗 Trasferimento</option>
          <option value="Altro">📋 Altro</option>
        </select>
      </div>
      <div class="form-group"><label>Luogo</label><input type="text" id="f-luogo" placeholder="Es. Chiesa di San Marco" /></div>
      <div class="form-group"><label>Durata (min)</label><input type="number" id="f-durata" min="5" step="5" placeholder="60" /></div>
      <div class="form-group full"><label>Note</label><textarea id="f-note" placeholder="Dettagli, persone coinvolte..."></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveEvento()">Salva</button>
      <button class="btn btn-ghost" onclick="closeForm()">Annulla</button>
    </div>
  </div>
  <div id="timeline-wrap"></div>
</div>
<div id="toast"></div>
`;

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const { uid, esc, toast } = App;

  const CAT_COLORS = { Cerimonia:'#c9a96e', Preparativi:'#8e44ad', Foto:'#e67e22', Ricevimento:'#27ae60', Trasferimento:'#2980b9', Altro:'#8a7968' };

  let prog = { data: '', eventi: [], eventOrder: [] };
  let editId = null;

  function save() { DS.set('ds_programma', prog); $('#last-saved').textContent = DS.lastSavedLabel(); }
  function load() {
    const d = DS.get('ds_programma');
    if (d) prog = d;
    if (!prog.eventi) prog.eventi = [];
    if (!prog.eventOrder) prog.eventOrder = prog.eventi.map(e => e.id);
    if (prog.data) {
      $('#input-data').value = prog.data;
      updateDataDisplay();
    }
    $('#last-saved').textContent = DS.lastSavedLabel();
  }
  function saveData() {
    prog.data = $('#input-data').value;
    updateDataDisplay(); save();
  }
  function updateDataDisplay() {
    const v = prog.data;
    if (!v) { $('#data-display').textContent = ''; return; }
    const d = new Date(v + 'T00:00:00');
    const opts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
    $('#data-display').textContent = d.toLocaleDateString('it-IT', opts);
  }

  function orderedEventi() {
    return prog.eventOrder.map(id => prog.eventi.find(e => e.id === id)).filter(Boolean);
  }

  function sortByTime() {
    prog.eventOrder = [...prog.eventi].sort((a,b) => a.ora.localeCompare(b.ora)).map(e => e.id);
    save(); renderTimeline(); toast('Eventi ordinati per orario');
  }

  function openForm(edata) {
    editId = edata ? edata.id : null;
    $('#form-title').textContent = editId ? 'Modifica evento' : 'Nuovo evento';
    $('#f-ora').value        = edata?.ora       || '';
    $('#f-titolo').value     = edata?.titolo    || '';
    $('#f-categoria').value  = edata?.categoria || 'Cerimonia';
    $('#f-luogo').value      = edata?.luogo     || '';
    $('#f-durata').value     = edata?.durata    || '';
    $('#f-note').value       = edata?.note      || '';
    $('#add-form').classList.add('open');
    $('#f-titolo').focus();
  }
  function editEvento(id) { openForm(prog.eventi.find(e => e.id === id)); }
  function closeForm() { $('#add-form').classList.remove('open'); editId = null; }

  function saveEvento() {
    const ora    = $('#f-ora').value;
    const titolo = $('#f-titolo').value.trim();
    if (!ora || !titolo) { toast('Inserisci orario e titolo'); return; }
    const wasEdit = !!editId;
    const obj = {
      id:        editId || uid(),
      ora, titolo,
      categoria: $('#f-categoria').value,
      luogo:     $('#f-luogo').value.trim(),
      durata:    parseInt($('#f-durata').value) || 0,
      note:      $('#f-note').value.trim()
    };
    if (wasEdit) {
      const i = prog.eventi.findIndex(e => e.id === editId);
      if (i >= 0) prog.eventi[i] = obj;
    } else {
      prog.eventi.push(obj);
      prog.eventOrder.push(obj.id);
    }
    save(); closeForm(); renderTimeline(); toast(wasEdit ? 'Evento aggiornato' : 'Evento aggiunto');
  }

  function moveEvento(id, dir) {
    const order = prog.eventOrder;
    const i = order.indexOf(id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    save(); renderTimeline();
  }

  function deleteEvento(id) {
    if (!confirm('Eliminare questo evento?')) return;
    prog.eventi     = prog.eventi.filter(e => e.id !== id);
    prog.eventOrder = prog.eventOrder.filter(i => i !== id);
    save(); renderTimeline(); toast('Evento eliminato');
  }

  function renderTimeline() {
    const wrap = $('#timeline-wrap');
    const list = orderedEventi();
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state">Nessun evento. Clicca "+ Aggiungi evento" per costruire la timeline.</div>';
      return;
    }
    const tl = document.createElement('div');
    tl.className = 'timeline';
    list.forEach(e => tl.appendChild(buildEventRow(e)));
    wrap.innerHTML = '';
    wrap.appendChild(tl);
    enableDrag(tl);
  }

  function buildEventRow(e) {
    const row = document.createElement('div');
    row.className = 'event-row';
    row.draggable = true;
    row.dataset.eid = e.id;
    const col = CAT_COLORS[e.categoria] || '#8a7968';
    row.innerHTML = `
      <div class="time-col">
        <div class="time-label">${esc(e.ora)}</div>
        <div class="time-dot" style="background:${col}"></div>
      </div>
      <div class="event-card">
        <div class="event-header">
          <span class="event-drag" title="Trascina per riordinare">⠿</span>
          <div class="event-cat-dot" style="background:${col}"></div>
          <input class="event-titolo-input" value="${esc(e.titolo)}"
            onblur="updateField('${e.id}','titolo',this.value)"
            onkeydown="if(event.key==='Enter')this.blur()" />
          <span class="event-cat-badge" style="color:${col}">${esc(e.categoria)}</span>
        </div>
        <div class="event-meta">
          ${e.luogo  ? `<span class="event-luogo">${esc(e.luogo)}</span>` : ''}
          ${e.durata ? `<span class="event-durata">${e.durata} min</span>` : ''}
        </div>
        ${e.note ? `<div class="event-note">${esc(e.note)}</div>` : ''}
        <div class="event-actions">
          <button class="btn btn-sm btn-ghost" onclick="moveEvento('${e.id}',-1)" title="Sposta su">▲</button>
          <button class="btn btn-sm btn-ghost" onclick="moveEvento('${e.id}',1)" title="Sposta giù">▼</button>
          <button class="btn btn-sm btn-ghost" onclick="editEvento('${e.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEvento('${e.id}')">✕</button>
        </div>
      </div>`;
    return row;
  }

  function updateField(id, field, val) {
    const e = prog.eventi.find(e => e.id === id);
    if (!e || !val.trim()) return;
    e[field] = val.trim();
    save();
  }

  function enableDrag(tl) {
    let dragging = null;
    tl.querySelectorAll('.event-row').forEach(row => {
      row.addEventListener('dragstart', e => {
        dragging = row;
        setTimeout(() => row.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        tl.querySelectorAll('.event-row').forEach(r => r.classList.remove('drop-target'));
        dragging = null;
        prog.eventOrder = [...tl.querySelectorAll('.event-row')].map(r => r.dataset.eid);
        save();
      });
      row.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragging || dragging === row) return;
        row.classList.add('drop-target');
        const rect = row.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) tl.insertBefore(dragging, row);
        else tl.insertBefore(dragging, row.nextSibling);
      });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', e => { e.preventDefault(); row.classList.remove('drop-target'); });
    });
  }

  Object.assign(window, { saveData, openForm, closeForm, saveEvento, editEvento, deleteEvento, moveEvento, sortByTime, updateField });

  load(); renderTimeline();
  const onChange = e => { if (e.detail.remote && e.detail.key === 'ds_programma') { load(); renderTimeline(); } };
  window.addEventListener('ds:change', onChange);
  return () => window.removeEventListener('ds:change', onChange);
}
