import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Budget – Day Special';

export const html = `
<style>
  .budget-input-bar { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 24px; margin-bottom: 24px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .budget-input-bar label { font-weight: 600; font-size: .95rem; }
  .budget-input-bar input { padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem; width: 180px; background: var(--surface); color: var(--text); }
  .budget-input-bar input:focus { outline: none; border-color: var(--accent); }
  .import-hint { font-size: .82rem; color: var(--muted); }
  .btn-import { padding: 8px 16px; background: var(--accent-soft); border: 1px solid var(--accent-line); color: var(--gold-txt); border-radius: 8px; cursor: pointer; font-size: .85rem; font-weight: 600; font-family: inherit; transition: background .15s; }
  .btn-import:hover { background: var(--accent-line); }
  .chart-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 24px; box-shadow: var(--shadow); }
  .chart-wrap h2 { font-size: 1rem; font-weight: 600; margin-bottom: 4px; }
  .chart-legend { font-size: .78rem; color: var(--muted); margin-bottom: 14px; display: flex; gap: 16px; }
  .chart-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 5px; vertical-align: -1px; }
  .chart-row { display: grid; grid-template-columns: 150px 1fr auto; gap: 12px; align-items: center; padding: 6px 0; }
  .chart-cat { font-size: .83rem; font-weight: 600; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chart-track { position: relative; height: 18px; background: var(--border-soft); border-radius: 5px; overflow: hidden; }
  .chart-prev { position: absolute; inset: 0 auto 0 0; background: var(--accent); opacity: .35; border-radius: 5px; transition: width .4s; }
  .chart-pag  { position: absolute; inset: 0 auto 0 0; background: var(--accent); border-radius: 5px; transition: width .4s; }
  .chart-val { font-size: .8rem; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  @media (max-width: 600px) { .chart-row { grid-template-columns: 90px 1fr auto; } }
  @media (max-width: 700px) {
    .table-wrap { overflow-x: visible; border: none; box-shadow: none; background: transparent; }
    table, tbody, tr, td { display: block; width: 100%; }
    thead { display: none; }
    tbody tr { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); margin-bottom: 12px; padding: 4px 14px; }
    tbody tr:hover { background: var(--surface); }
    td { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--border-soft); white-space: normal; }
    td:last-child { border-bottom: none; }
    td::before { content: attr(data-label); flex-shrink: 0; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
    td .inline-input { text-align: right; }
    td .inline-num { width: auto; flex: 1; }
    td .stato-select { flex: 1; }
    .td-actions { justify-content: flex-end; }
    .td-actions::before { content: none; }
  }
  .cat-badge { font-size: .72rem; padding: 2px 9px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
  .stato-da_pagare { border-color: var(--border); color: var(--muted); }
  .stato-acconto   { border-color: var(--warning); color: var(--warning); }
  .stato-saldato   { border-color: var(--success); color: var(--success); }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Budget</h1>
  <div class="header-actions">
    <button class="btn btn-ghost btn-sm" id="btn-csv" title="Esporta le voci di spesa in CSV">⬇ CSV</button>
    <button class="btn btn-ghost btn-sm" id="btn-print" title="Stampa il budget">🖨 Stampa</button>
    <button class="icon-btn" id="theme-toggle">🌙</button>
  </div>
</header>
<div class="container">
  <details class="collapsible">
    <summary>📊 Riepilogo budget</summary>
    <div class="summary">
      <div class="stat-card"><div class="val" id="s-totale">€ 0</div><div class="lbl">Budget totale</div></div>
      <div class="stat-card warn"><div class="val" id="s-preventivato">€ 0</div><div class="lbl">Preventivato</div></div>
      <div class="stat-card success"><div class="val" id="s-pagato">€ 0</div><div class="lbl">Pagato</div></div>
      <div class="stat-card"><div class="val" id="s-rimanente">€ 0</div><div class="lbl">Rimanente</div></div>
      <div class="stat-card danger"><div class="val" id="s-sforamento">€ 0</div><div class="lbl">Sforamento</div></div>
    </div>
  </details>
  <details class="collapsible">
    <summary>💰 Budget totale e catering</summary>
    <div class="budget-input-bar collapse-inner">
      <label>💰 Budget totale:</label>
      <input type="number" id="input-budget-totale" min="0" step="100" placeholder="es. 20000" />
      <span class="import-hint">Catering (da Invitati):</span>
      <strong id="costo-catering" style="color:var(--accent-dk)">—</strong>
      <button class="btn-import" id="btn-importa-catering">↓ Importa come voce</button>
    </div>
  </details>
  <div class="progress-wrap">
    <div class="progress-label"><span>Preventivato sul budget</span><span id="progress-pct">0%</span></div>
    <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
  </div>
  <div class="chart-wrap" id="chart-wrap" style="display:none">
    <h2>📊 Spese per categoria</h2>
    <div class="chart-legend">
      <span><span class="dot" style="background:var(--accent);opacity:.35"></span>Preventivato</span>
      <span><span class="dot" style="background:var(--accent)"></span>Pagato</span>
    </div>
    <div id="chart-rows"></div>
  </div>
  <div class="toolbar">
    <button class="btn btn-primary" id="btn-open-form">+ Aggiungi voce</button>
    <select class="filter-select" id="filter-cat"><option value="">Tutte le categorie</option></select>
    <select class="filter-select" id="filter-stato">
      <option value="">Tutti gli stati</option>
      <option value="da_pagare">Da pagare</option>
      <option value="acconto">Acconto versato</option>
      <option value="saldato">Saldato</option>
    </select>
  </div>
  <div class="add-form" id="add-form">
    <h3 id="form-title">Nuova voce di spesa</h3>
    <div class="form-grid">
      <div class="form-group full"><label>Descrizione *</label><input type="text" id="f-descrizione" placeholder="Es. Fotografo" /></div>
      <div class="form-group">
        <label>Categoria *</label>
        <select id="f-categoria">
          <option value="Ricevimento">Ricevimento</option>
          <option value="Cerimonia">Cerimonia</option>
          <option value="Fotografia">Fotografia</option>
          <option value="Fiori">Fiori & Decorazioni</option>
          <option value="Musica">Musica & Intrattenimento</option>
          <option value="Abbigliamento">Abbigliamento</option>
          <option value="Viaggio">Viaggio di Nozze</option>
          <option value="Partecipazioni">Partecipazioni & Bomboniere</option>
          <option value="Altro">Altro</option>
        </select>
      </div>
      <div class="form-group"><label>Preventivo (€)</label><input type="number" id="f-preventivo" min="0" step="0.01" placeholder="0.00" /></div>
      <div class="form-group"><label>Pagato (€)</label><input type="number" id="f-pagato" min="0" step="0.01" placeholder="0.00" /></div>
      <div class="form-group">
        <label>Stato</label>
        <select id="f-stato">
          <option value="da_pagare">Da pagare</option>
          <option value="acconto">Acconto versato</option>
          <option value="saldato">Saldato</option>
        </select>
      </div>
      <div class="form-group full"><label>Note</label><textarea id="f-note" placeholder="Informazioni aggiuntive..."></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btn-save-voce">Salva</button>
      <button class="btn btn-ghost" id="btn-close-form">Annulla</button>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Descrizione</th><th>Categoria</th><th>Preventivo</th><th>Pagato</th><th>Stato</th><th>Note</th><th class="no-print"></th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
    <div class="empty-state" id="empty-state" style="display:none">Nessuna voce di spesa. Clicca "+ Aggiungi voce" per iniziare.</div>
  </div>
</div>
<div id="toast"></div>
`;

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const { uid, esc, toast, fmtEur: fmt } = App;

  const CATEGORIE_COLORS = {
    'Ricevimento':    ['var(--info-soft)',    'var(--info)'],
    'Cerimonia':      ['var(--gold-soft)',    'var(--gold-txt)'],
    'Fotografia':     ['var(--purple-soft)',  'var(--purple)'],
    'Fiori':          ['var(--success-soft)', 'var(--success)'],
    'Musica':         ['var(--warning-soft)', 'var(--warning)'],
    'Abbigliamento':  ['var(--danger-soft)',  'var(--danger)'],
    'Viaggio':        ['var(--teal-soft)',    'var(--teal)'],
    'Partecipazioni': ['var(--purple-soft)',  'var(--purple)'],
    'Altro':          ['var(--border-soft)',  'var(--muted)']
  };
  function catStyle(cat) {
    const [bg, col] = CATEGORIE_COLORS[cat] || CATEGORIE_COLORS['Altro'];
    return `background:${bg};color:${col}`;
  }

  let budget = { totale: 0, voci: [] };
  let editId = null;

  function save() { DS.set('ds_budget', budget); }
  function load() {
    const d = DS.get('ds_budget');
    if (d) budget = d;
    if (!budget.voci) budget.voci = [];
    $('#input-budget-totale').value = budget.totale || '';
  }

  function saveBudgetTotale() {
    budget.totale = parseFloat($('#input-budget-totale').value) || 0;
    save(); updateSummary();
  }

  function getCateringCost() {
    const inv = DS.get('ds_invitati');
    const pr  = DS.get('ds_prices');
    if (!inv || !pr) return null;
    let tot = 0;
    const unit = guest => {
      if (guest.tipo === 'bambino') return pr.bambino || 0;
      if (guest.tipo === 'neonato') return pr.neonato || 0;
      const m = pr.adultoMenu || {};
      return (guest.menu && m[guest.menu]) ? m[guest.menu] : (pr.adulto || 0);
    };
    const addGuest = guest => { if (!guest.formale && guest.status !== 'annullato') tot += unit(guest); };
    if (inv.sposi && inv.sposi.guests) inv.sposi.guests.forEach(addGuest);
    ['sposo','sposa','comuni'].forEach(sec => {
      if (!inv[sec]) return;
      inv[sec].groups.forEach(g => g.guests.forEach(addGuest));
    });
    return tot;
  }
  function refreshCateringHint() {
    const c = getCateringCost();
    $('#costo-catering').textContent = c !== null ? fmt(c) : '(nessun dato)';
  }
  function importaCatering() {
    const c = getCateringCost();
    if (c === null) { toast('Nessun dato invitati trovato'); return; }
    if (c === 0)    { toast('Il costo catering è € 0: imposta i prezzi del menù in Invitati'); return; }
    const exists = budget.voci.find(v => v._catering);
    if (exists) { exists.preventivo = c; save(); renderTable(); toast('Voce catering aggiornata'); return; }
    budget.voci.push({ id: uid(), descrizione: 'Catering / Banchetto', categoria: 'Ricevimento', preventivo: c, pagato: 0, stato: 'da_pagare', note: 'Importato da sezione Invitati', _catering: true });
    save(); renderTable(); toast('Catering aggiunto al budget');
  }

  function updateSummary() {
    const tot   = budget.totale || 0;
    const prev  = budget.voci.reduce((s,v) => s + (v.preventivo||0), 0);
    const pag   = budget.voci.reduce((s,v) => s + (v.pagato||0), 0);
    const rim   = tot - prev;
    const sfora = rim < 0 ? Math.abs(rim) : 0;
    $('#s-totale').textContent       = fmt(tot);
    $('#s-preventivato').textContent = fmt(prev);
    $('#s-pagato').textContent       = fmt(pag);
    $('#s-rimanente').textContent    = fmt(rim < 0 ? 0 : rim);
    $('#s-sforamento').textContent   = sfora > 0 ? fmt(sfora) : '—';
    const pct = tot > 0 ? Math.min((prev/tot)*100, 100) : 0;
    const fill = $('#progress-fill');
    fill.style.width = pct + '%';
    fill.classList.toggle('over', prev > tot && tot > 0);
    $('#progress-pct').textContent = Math.round((tot>0?(prev/tot)*100:0)) + '%';
    renderChart();
  }

  function renderChart() {
    const wrap = $('#chart-wrap');
    const byCat = {};
    budget.voci.forEach(v => {
      if (!byCat[v.categoria]) byCat[v.categoria] = { prev: 0, pag: 0 };
      byCat[v.categoria].prev += v.preventivo || 0;
      byCat[v.categoria].pag  += v.pagato || 0;
    });
    const entries = Object.entries(byCat).filter(([, x]) => x.prev > 0 || x.pag > 0)
      .sort((a, b) => b[1].prev - a[1].prev);
    if (!entries.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    const max = Math.max(...entries.map(([, x]) => Math.max(x.prev, x.pag)));
    $('#chart-rows').innerHTML = entries.map(([cat, x]) => {
      const [, col] = CATEGORIE_COLORS[cat] || CATEGORIE_COLORS['Altro'];
      return `<div class="chart-row">
        <div class="chart-cat" style="color:${col}">${esc(cat)}</div>
        <div class="chart-track">
          <div class="chart-prev" style="width:${max ? (x.prev/max)*100 : 0}%;background:${col}"></div>
          <div class="chart-pag"  style="width:${max ? (x.pag /max)*100 : 0}%;background:${col}"></div>
        </div>
        <div class="chart-val">${fmt(x.pag)} / ${fmt(x.prev)}</div>
      </div>`;
    }).join('');
  }

  function refreshCatFilter() {
    const cats = [...new Set(budget.voci.map(v => v.categoria))].sort();
    const sel = $('#filter-cat');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tutte le categorie</option>';
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    sel.value = cur;
  }

  function renderTable() {
    const catF   = $('#filter-cat').value;
    const statoF = $('#filter-stato').value;
    let voci = budget.voci;
    if (catF)   voci = voci.filter(v => v.categoria === catF);
    if (statoF) voci = voci.filter(v => v.stato === statoF);
    const tbody = $('#tbody');
    tbody.innerHTML = '';
    $('#empty-state').style.display = budget.voci.length === 0 ? 'block' : 'none';
    voci.forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Descrizione"><input class="inline-input" value="${esc(v.descrizione)}" data-act="desc" data-id="${v.id}" /></td>
        <td data-label="Categoria"><span class="cat-badge" style="${catStyle(v.categoria)}">${esc(v.categoria)}</span></td>
        <td data-label="Preventivo"><input class="inline-input inline-num" type="number" value="${v.preventivo||0}" data-act="prev" data-id="${v.id}" /></td>
        <td data-label="Pagato"><input class="inline-input inline-num" type="number" value="${v.pagato||0}" data-act="pag" data-id="${v.id}" /></td>
        <td data-label="Stato">
          <select class="stato-select stato-${v.stato}" data-act="stato" data-id="${v.id}">
            <option value="da_pagare" ${v.stato==='da_pagare'?'selected':''}>Da pagare</option>
            <option value="acconto"   ${v.stato==='acconto'?'selected':''}>Acconto</option>
            <option value="saldato"   ${v.stato==='saldato'?'selected':''}>Saldato</option>
          </select>
        </td>
        <td data-label="Note"><input class="inline-input" value="${esc(v.note||'')}" placeholder="—" data-act="note" data-id="${v.id}" /></td>
        <td class="no-print td-actions" style="white-space:nowrap">
          <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${v.id}" style="margin-right:4px">✏️</button>
          <button class="btn btn-sm btn-danger" data-act="del" data-id="${v.id}">✕</button>
        </td>`;
      tbody.appendChild(tr);
    });
    refreshCatFilter();
    updateSummary();
  }

  function updateField(id, field, val) {
    const v = budget.voci.find(v => v.id === id);
    if (!v) return;
    v[field] = val;
    save(); updateSummary();
  }

  function openForm(data) {
    editId = data ? data.id : null;
    $('#form-title').textContent = editId ? 'Modifica voce' : 'Nuova voce di spesa';
    $('#f-descrizione').value = data?.descrizione || '';
    $('#f-categoria').value   = data?.categoria   || 'Ricevimento';
    $('#f-preventivo').value  = data?.preventivo  || '';
    $('#f-pagato').value      = data?.pagato      || '';
    $('#f-stato').value       = data?.stato       || 'da_pagare';
    $('#f-note').value        = data?.note        || '';
    $('#add-form').classList.add('open');
    $('#f-descrizione').focus();
  }
  function closeForm() { $('#add-form').classList.remove('open'); editId = null; }

  function saveVoce() {
    const desc = $('#f-descrizione').value.trim();
    if (!desc) { toast('Inserisci una descrizione'); return; }
    const wasEdit = !!editId;
    const obj = {
      id: editId || uid(),
      descrizione: desc,
      categoria:   $('#f-categoria').value,
      preventivo:  parseFloat($('#f-preventivo').value) || 0,
      pagato:      parseFloat($('#f-pagato').value)     || 0,
      stato:       $('#f-stato').value,
      note:        $('#f-note').value.trim()
    };
    if (wasEdit) {
      const i = budget.voci.findIndex(v => v.id === editId);
      if (i >= 0) budget.voci[i] = { ...budget.voci[i], ...obj };
    } else {
      budget.voci.push(obj);
    }
    save(); closeForm(); renderTable(); toast(wasEdit ? 'Voce aggiornata' : 'Voce aggiunta');
  }

  function editVoce(id) { openForm(budget.voci.find(v => v.id === id)); }
  function deleteVoce(id) {
    if (!confirm('Eliminare questa voce?')) return;
    budget.voci = budget.voci.filter(v => v.id !== id);
    save(); renderTable(); toast('Voce eliminata');
  }

  function exportCSV() {
    if (!budget.voci.length) { toast('Nessuna voce da esportare'); return; }
    const STATO_LABEL = { da_pagare: 'Da pagare', acconto: 'Acconto versato', saldato: 'Saldato' };
    const rows = [['Descrizione', 'Categoria', 'Preventivo (€)', 'Pagato (€)', 'Stato', 'Note']];
    budget.voci.forEach(v => rows.push([
      v.descrizione, v.categoria,
      (v.preventivo || 0).toFixed(2).replace('.', ','),
      (v.pagato || 0).toFixed(2).replace('.', ','),
      STATO_LABEL[v.stato] || v.stato, v.note || ''
    ]));
    App.downloadCSV('budget-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV esportato (' + budget.voci.length + ' voci)');
  }

  // ── Eventi (delega su tbody per gli input generati dinamicamente) ──
  $('#input-budget-totale').addEventListener('input', saveBudgetTotale);
  $('#btn-importa-catering').addEventListener('click', importaCatering);
  $('#btn-open-form').addEventListener('click', () => openForm());
  $('#filter-cat').addEventListener('change', renderTable);
  $('#filter-stato').addEventListener('change', renderTable);
  $('#btn-save-voce').addEventListener('click', saveVoce);
  $('#btn-close-form').addEventListener('click', closeForm);
  $('#btn-csv').addEventListener('click', exportCSV);
  $('#btn-print').addEventListener('click', () => window.print());

  $('#tbody').addEventListener('blur', (e) => {
    const t = e.target;
    const act = t.dataset && t.dataset.act;
    if (!act) return;
    const id = t.dataset.id;
    if (act === 'desc') updateField(id, 'descrizione', t.value);
    else if (act === 'prev') updateField(id, 'preventivo', parseFloat(t.value) || 0);
    else if (act === 'pag') updateField(id, 'pagato', parseFloat(t.value) || 0);
    else if (act === 'note') updateField(id, 'note', t.value);
  }, true);
  $('#tbody').addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.act === 'stato') {
      updateField(t.dataset.id, 'stato', t.value);
      t.className = 'stato-select stato-' + t.value;
    }
  });
  $('#tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'edit') editVoce(btn.dataset.id);
    else if (btn.dataset.act === 'del') deleteVoce(btn.dataset.id);
  });

  load(); refreshCateringHint(); renderTable();
  const onChange = e => {
    if (e.detail.key === 'ds_invitati' || e.detail.key === 'ds_prices') refreshCateringHint();
    if (e.detail.remote && e.detail.key === 'ds_budget') { load(); renderTable(); }
  };
  window.addEventListener('ds:change', onChange);
  return () => window.removeEventListener('ds:change', onChange);
}
