import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Fornitori – Day Special';

export const html = `
<style>
  .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr)); gap: 18px; }
  .fornitore-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; animation: fadeUp .3s ease both; transition: box-shadow .18s, border-color .18s; }
  .fornitore-card:hover { box-shadow: var(--shadow-lg); border-color: var(--accent); }
  .card-top { padding: 16px 18px 12px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 12px; }
  .card-icon { font-size: 1.8rem; flex-shrink: 0; }
  .card-info { flex: 1; }
  .card-nome { font-weight: 700; font-size: 1rem; }
  .card-azienda { font-size: .83rem; color: var(--muted); margin-top: 2px; }
  .cat-badge { display: inline-block; font-size: .72rem; padding: 2px 9px; border-radius: 10px; font-weight: 600; margin-top: 6px; background: var(--border-soft); color: var(--text); }
  .stato-badge { font-size: .72rem; padding: 2px 9px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
  .card-body { padding: 12px 18px; font-size: .85rem; display: flex; flex-direction: column; gap: 6px; }
  .card-row { display: flex; align-items: center; gap: 8px; color: var(--muted); }
  .card-row a { color: var(--info); text-decoration: none; }
  .card-row a:hover { text-decoration: underline; }
  .card-row strong { color: var(--text); }
  .card-note { font-size: .82rem; color: var(--muted); font-style: italic; border-top: 1px solid var(--border); padding-top: 8px; margin-top: 4px; }
  .card-actions { padding: 10px 18px; border-top: 1px solid var(--border); display: flex; gap: 8px; }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Fornitori</h1>
  <div class="header-actions">
    <span class="lbl-saved" id="last-saved"></span>
    <button class="btn btn-ghost btn-sm" onclick="exportCSV()" title="Esporta i fornitori in CSV">⬇ CSV</button>
    <button class="icon-btn" id="theme-toggle">🌙</button>
  </div>
</header>
<div class="container">
  <details class="collapsible">
    <summary>📊 Riepilogo fornitori</summary>
    <div class="summary">
      <div class="stat-card"><div class="val" id="s-tot">0</div><div class="lbl">Fornitori</div></div>
      <div class="stat-card"><div class="val" id="s-dacontattare">0</div><div class="lbl">Da contattare</div></div>
      <div class="stat-card"><div class="val" id="s-contattati">0</div><div class="lbl">Contattati</div></div>
      <div class="stat-card"><div class="val" id="s-contratti">0</div><div class="lbl">Contratti firmati</div></div>
      <div class="stat-card"><div class="val" id="s-pagati">0</div><div class="lbl">Saldati</div></div>
      <div class="stat-card"><div class="val" id="s-importo">€ 0</div><div class="lbl">Importo totale</div></div>
    </div>
  </details>
  <div class="toolbar">
    <button class="btn btn-primary" onclick="openForm()">+ Aggiungi fornitore</button>
    <select class="filter-select" id="filter-cat" onchange="renderCards()"><option value="">Tutte le categorie</option></select>
    <select class="filter-select" id="filter-stato" onchange="renderCards()">
      <option value="">Tutti gli stati</option>
      <option value="dacontattare">Da contattare</option>
      <option value="contattato">Contattato</option>
      <option value="preventivo">Preventivo ricevuto</option>
      <option value="contratto">Contratto firmato</option>
      <option value="saldato">Saldato</option>
    </select>
  </div>
  <div class="add-form" id="add-form">
    <h3 id="form-title">Nuovo fornitore</h3>
    <div class="form-grid">
      <div class="form-group"><label>Nome *</label><input type="text" id="f-nome" placeholder="Es. Mario Rossi" /></div>
      <div class="form-group"><label>Azienda</label><input type="text" id="f-azienda" placeholder="Es. Studio Foto" /></div>
      <div class="form-group">
        <label>Categoria *</label>
        <select id="f-categoria">
          <option value="Fotografia">📷 Fotografia & Video</option>
          <option value="Catering">🍽️ Catering & Banqueting</option>
          <option value="Location">🏛️ Location</option>
          <option value="Fiori">🌸 Fiori & Decorazioni</option>
          <option value="Musica">🎵 Musica & Intrattenimento</option>
          <option value="Abito">👗 Abito & Accessori</option>
          <option value="Torta">🎂 Torta Nuziale</option>
          <option value="Trasporti">🚗 Trasporti</option>
          <option value="Acconciatura">💄 Acconciatura & Make-up</option>
          <option value="Bomboniere">🎁 Bomboniere & Partecipazioni</option>
          <option value="Altro">📋 Altro</option>
        </select>
      </div>
      <div class="form-group"><label>Telefono</label><input type="tel" id="f-telefono" placeholder="+39 000 0000000" /></div>
      <div class="form-group"><label>Email</label><input type="email" id="f-email" placeholder="email@esempio.it" /></div>
      <div class="form-group"><label>Sito web</label><input type="url" id="f-sito" placeholder="https://..." /></div>
      <div class="form-group"><label>Preventivo (€)</label><input type="number" id="f-preventivo" min="0" step="0.01" placeholder="0.00" /></div>
      <div class="form-group"><label>Importo accordato (€)</label><input type="number" id="f-importo" min="0" step="0.01" placeholder="0.00" /></div>
      <div class="form-group">
        <label>Stato</label>
        <select id="f-stato">
          <option value="dacontattare">Da contattare</option>
          <option value="contattato">Contattato</option>
          <option value="preventivo">Preventivo ricevuto</option>
          <option value="contratto">Contratto firmato</option>
          <option value="saldato">Saldato</option>
        </select>
      </div>
      <div class="form-group full"><label>Note</label><textarea id="f-note" placeholder="Condizioni, dettagli accordo..."></textarea></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="saveFornitore()">Salva</button>
      <button class="btn btn-ghost" onclick="closeForm()">Annulla</button>
    </div>
  </div>
  <div id="cards-container"></div>
</div>
<div id="toast"></div>
`;

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const { uid, esc, toast, fmtEur: fmt } = App;

  function safeUrl(u) {
    const s = (u || '').trim();
    if (!s) return '#';
    if (/^\s*(javascript|data|vbscript):/i.test(s)) return '#';
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://' + s.replace(/^\/+/, '');
  }

  const CAT_ICONS = { Fotografia:'📷', Catering:'🍽️', Location:'🏛️', Fiori:'🌸', Musica:'🎵', Abito:'👗', Torta:'🎂', Trasporti:'🚗', Acconciatura:'💄', Bomboniere:'🎁', Altro:'📋' };
  const STATO_STYLE = {
    dacontattare: 'background:var(--border-soft);color:var(--muted)',
    contattato: 'background:var(--info-soft);color:var(--info)',
    preventivo: 'background:var(--gold-soft);color:var(--gold-txt)',
    contratto:  'background:var(--success-soft);color:var(--success)',
    saldato:    'background:var(--teal-soft);color:var(--teal)'
  };
  const STATO_LABEL = { dacontattare:'Da contattare', contattato:'Contattato', preventivo:'Preventivo ricevuto', contratto:'Contratto firmato', saldato:'Saldato' };

  let data = { fornitori: [] };
  let editId = null;

  function save() { DS.set('ds_fornitori', data); $('#last-saved').textContent = DS.lastSavedLabel(); }
  function load() {
    const d = DS.get('ds_fornitori');
    if (d) data = d;
    if (!data.fornitori) data.fornitori = [];
    $('#last-saved').textContent = DS.lastSavedLabel();
  }

  function updateSummary() {
    const f = data.fornitori;
    $('#s-tot').textContent          = f.length;
    $('#s-dacontattare').textContent = f.filter(x => x.stato === 'dacontattare').length;
    $('#s-contattati').textContent   = f.filter(x => x.stato === 'contattato').length;
    $('#s-contratti').textContent  = f.filter(x => x.stato === 'contratto').length;
    $('#s-pagati').textContent     = f.filter(x => x.stato === 'saldato').length;
    const tot = f.reduce((s,x) => s + (x.importo || x.preventivo || 0), 0);
    $('#s-importo').textContent    = fmt(tot);
  }

  function refreshFilters() {
    const cats = [...new Set(data.fornitori.map(f => f.categoria))].sort();
    const sel = $('#filter-cat');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tutte le categorie</option>';
    cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    sel.value = cur;
  }

  function renderCards() {
    const catF   = $('#filter-cat').value;
    const statoF = $('#filter-stato').value;
    let list = data.fornitori;
    if (catF)   list = list.filter(f => f.categoria === catF);
    if (statoF) list = list.filter(f => f.stato === statoF);

    const wrap = $('#cards-container');
    if (!list.length) {
      wrap.innerHTML = '<div class="empty-state">Nessun fornitore. Clicca "+ Aggiungi fornitore" per iniziare.</div>';
      refreshFilters(); updateSummary(); return;
    }
    const grid = document.createElement('div');
    grid.className = 'cards-grid';
    list.forEach(f => grid.appendChild(buildCard(f)));
    wrap.innerHTML = '';
    wrap.appendChild(grid);
    refreshFilters(); updateSummary();
  }

  function buildCard(f) {
    const div = document.createElement('div');
    div.className = 'fornitore-card';
    div.innerHTML = `
      <div class="card-top">
        <div class="card-icon">${CAT_ICONS[f.categoria]||'📋'}</div>
        <div class="card-info">
          <div class="card-nome">${esc(f.nome)}</div>
          ${f.azienda ? `<div class="card-azienda">${esc(f.azienda)}</div>` : ''}
          <span class="cat-badge">${esc(f.categoria)}</span>
          <span class="stato-badge" style="${STATO_STYLE[f.stato]||''}">${STATO_LABEL[f.stato]||''}</span>
        </div>
      </div>
      <div class="card-body">
        ${f.telefono ? `<div class="card-row">📞 <a href="tel:${esc(f.telefono)}">${esc(f.telefono)}</a></div>` : ''}
        ${f.email    ? `<div class="card-row">✉️ <a href="mailto:${esc(f.email)}">${esc(f.email)}</a></div>` : ''}
        ${f.sito     ? `<div class="card-row">🌐 <a href="${esc(safeUrl(f.sito))}" target="_blank" rel="noopener">Sito web</a></div>` : ''}
        ${f.preventivo ? `<div class="card-row">💰 Preventivo: <strong>${fmt(f.preventivo)}</strong></div>` : ''}
        ${f.importo    ? `<div class="card-row">✅ Accordato: <strong>${fmt(f.importo)}</strong></div>` : ''}
        ${f.note ? `<div class="card-note">${esc(f.note)}</div>` : ''}
      </div>
      <div class="card-actions">
        <button class="btn btn-sm btn-ghost" onclick="editFornitore('${f.id}')">✏️ Modifica</button>
        <button class="btn btn-sm btn-danger" onclick="deleteFornitore('${f.id}')">✕ Elimina</button>
      </div>`;
    return div;
  }

  function openForm(fdata) {
    editId = fdata ? fdata.id : null;
    $('#form-title').textContent = editId ? 'Modifica fornitore' : 'Nuovo fornitore';
    $('#f-nome').value       = fdata?.nome      || '';
    $('#f-azienda').value    = fdata?.azienda   || '';
    $('#f-categoria').value  = fdata?.categoria || 'Fotografia';
    $('#f-telefono').value   = fdata?.telefono  || '';
    $('#f-email').value      = fdata?.email     || '';
    $('#f-sito').value       = fdata?.sito      || '';
    $('#f-preventivo').value = fdata?.preventivo || '';
    $('#f-importo').value    = fdata?.importo   || '';
    $('#f-stato').value      = fdata?.stato     || 'dacontattare';
    $('#f-note').value       = fdata?.note      || '';
    $('#add-form').classList.add('open');
    $('#f-nome').focus();
  }
  function closeForm() { $('#add-form').classList.remove('open'); editId = null; }

  function saveFornitore() {
    const nome = $('#f-nome').value.trim();
    if (!nome) { toast('Inserisci il nome del fornitore'); return; }
    const wasEdit = !!editId;
    const obj = {
      id:         editId || uid(),
      nome,
      azienda:    $('#f-azienda').value.trim(),
      categoria:  $('#f-categoria').value,
      telefono:   $('#f-telefono').value.trim(),
      email:      $('#f-email').value.trim(),
      sito:       $('#f-sito').value.trim(),
      preventivo: parseFloat($('#f-preventivo').value) || 0,
      importo:    parseFloat($('#f-importo').value)    || 0,
      stato:      $('#f-stato').value,
      note:       $('#f-note').value.trim()
    };
    if (wasEdit) {
      const i = data.fornitori.findIndex(f => f.id === editId);
      if (i >= 0) data.fornitori[i] = obj;
    } else {
      data.fornitori.push(obj);
    }
    save(); closeForm(); renderCards(); toast(wasEdit ? 'Fornitore aggiornato' : 'Fornitore aggiunto');
  }

  function editFornitore(id) { openForm(data.fornitori.find(f => f.id === id)); }
  function deleteFornitore(id) {
    if (!confirm('Eliminare questo fornitore?')) return;
    data.fornitori = data.fornitori.filter(f => f.id !== id);
    save(); renderCards(); toast('Fornitore eliminato');
  }

  function exportCSV() {
    if (!data.fornitori.length) { toast('Nessun fornitore da esportare'); return; }
    const rows = [['Nome', 'Azienda', 'Categoria', 'Telefono', 'Email', 'Sito', 'Preventivo (€)', 'Accordato (€)', 'Stato', 'Note']];
    data.fornitori.forEach(f => rows.push([
      f.nome, f.azienda || '', f.categoria, f.telefono || '', f.email || '', f.sito || '',
      (f.preventivo || 0).toFixed(2).replace('.', ','),
      (f.importo || 0).toFixed(2).replace('.', ','),
      STATO_LABEL[f.stato] || f.stato, f.note || ''
    ]));
    App.downloadCSV('fornitori-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV esportato (' + data.fornitori.length + ' fornitori)');
  }

  // Le view legacy usano onclick="..." nel markup generato: esposte su window,
  // sovrascritte ad ogni mount (solo una vista è attiva alla volta nella SPA).
  Object.assign(window, { openForm, closeForm, saveFornitore, editFornitore, deleteFornitore, renderCards, exportCSV });

  load(); renderCards();
  const onChange = e => { if (e.detail.remote && e.detail.key === 'ds_fornitori') { load(); renderCards(); } };
  window.addEventListener('ds:change', onChange);
  return () => window.removeEventListener('ds:change', onChange);
}
