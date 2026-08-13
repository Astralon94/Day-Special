import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Tavoli – Day Special';

export const html = `
<style>
  /* Due colonne su desktop: sala a sinistra, pannelli operativi a destra
     (sticky, così ospiti e tavoli restano visibili insieme durante il drag). */
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: start; }
  .room-main { min-width: 0; }
  .room-side { position: sticky; top: 82px; display: flex; flex-direction: column; gap: 18px; }
  .room-card, .tables-list-card, .unassigned-panel, .selected-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .room-card { border-color: color-mix(in srgb, var(--border) 76%, var(--accent)); }
  .room-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border); background: var(--surface); flex-wrap: wrap; }
  .room-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .room-title { font-weight: 700; font-size: .92rem; }
  .room-hint { color: var(--muted); font-size: .78rem; }
  .room-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: .82rem; color: var(--muted); user-select: none; }
  .room-toggle input { accent-color: var(--accent); }
  .room-zoom { min-width: 48px; text-align: center; font-size: .8rem; color: var(--muted); font-variant-numeric: tabular-nums; }
  .room-viewport { position: relative; height: min(72vh, 780px); min-height: 560px; overflow: hidden; background: color-mix(in srgb, var(--bg) 88%, var(--border)); touch-action: none; cursor: grab; box-shadow: inset 0 12px 30px color-mix(in srgb, var(--text) 5%, transparent); }
  .room-viewport.dragging { cursor: grabbing; }
  .room-world { position: absolute; left: 0; top: 0; width: 1800px; height: 1100px; transform-origin: 0 0; background-color: var(--surface); background-image: radial-gradient(circle, color-mix(in srgb, var(--border) 72%, transparent) 1.2px, transparent 1.3px); background-size: 40px 40px; border: 3px solid color-mix(in srgb, var(--border) 82%, var(--accent)); border-radius: 18px; box-shadow: 0 14px 40px color-mix(in srgb, var(--text) 12%, transparent), inset 0 0 0 12px color-mix(in srgb, var(--surface-2) 55%, transparent); }
  .room-empty { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); color: var(--muted); font-size: .9rem; text-align: center; pointer-events: none; }
  .room-table { position: absolute; width: 128px; height: 128px; transform-origin: 50% 50%; display: flex; align-items: center; justify-content: center; cursor: grab; user-select: none; touch-action: none; }
  .room-table:active { cursor: grabbing; }
  .table-shape { width: 118px; height: 118px; border: 2px solid color-mix(in srgb, var(--border) 72%, var(--accent)); background: var(--surface); box-shadow: 0 8px 22px color-mix(in srgb, var(--text) 11%, transparent); display: flex; align-items: center; justify-content: center; transition: border-color .15s, box-shadow .15s, transform .15s; }
  .shape-round .table-shape { border-radius: 999px; }
  .shape-rect { width: 156px; height: 112px; }
  .shape-rect .table-shape { width: 148px; height: 96px; border-radius: 10px; }
  .room-table.is-full .table-shape { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
  .room-table.is-sposi .table-shape { border-color: var(--accent); box-shadow: 0 0 0 3px var(--gold-soft), 0 8px 22px color-mix(in srgb, var(--text) 11%, transparent); }
  .room-table.selected .table-shape { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft), var(--shadow-lg); }
  .room-table.drag-over .table-shape { outline: 3px dashed var(--accent); outline-offset: 4px; }
  /* Sedie: pallini lungo il perimetro (pieni = occupati). Leggibili a ogni zoom. */
  .seat { position: absolute; width: 9px; height: 9px; border-radius: 50%; background: var(--surface); border: 1.5px solid color-mix(in srgb, var(--muted) 55%, var(--border)); transform: translate(-50%, -50%); pointer-events: none; }
  .seat.occ { background: var(--accent); border-color: var(--accent-dk); }
  .table-center { transform: rotate(var(--unrot, 0deg)); text-align: center; width: 100px; pointer-events: none; }
  .table-number { display: block; font-weight: 800; font-size: 2rem; color: var(--text); line-height: .95; font-variant-numeric: tabular-nums; }
  .table-occ { display: inline-block; margin-top: 6px; padding: 2px 9px; border-radius: 999px; background: var(--success-soft); color: var(--success); font-size: .8rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .table-occ.near { background: var(--warning-soft); color: var(--warning); }
  .table-occ.full { background: var(--danger-soft); color: var(--danger); }
  .table-tag { display: inline-block; margin-top: 5px; padding: 1px 8px; border-radius: 999px; background: var(--gold-soft); color: var(--gold-txt); font-size: .62rem; font-weight: 700; white-space: nowrap; }
  /* A zoom molto basso il testo secondario diventa illeggibile: restano numero e sedie. */
  .zoom-far .table-occ, .zoom-far .table-tag { display: none; }
  .chip-tipo { font-size: .65rem; padding: 1px 5px; border-radius: 8px; font-weight: 700; }
  .chip-adulto  { background: var(--info-soft); color: var(--info); }
  .chip-bambino { background: var(--success-soft); color: var(--success); }
  .chip-neonato { background: var(--gold-soft); color: var(--gold-txt); }
  .selected-panel { display: none; }
  .selected-panel.show { display: block; }
  .side-header, .panel-header { background: var(--surface-2); border-bottom: 1px solid var(--border); padding: 12px 16px; font-weight: 700; font-size: .9rem; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .side-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .side-body { padding: 12px 14px; }
  .table-edit-grid { display: grid; grid-template-columns: 96px 1fr; gap: 10px; }
  .table-edit-grid .full { grid-column: 1 / -1; }
  .mini-field { display: flex; flex-direction: column; gap: 4px; }
  .mini-field label { font-size: .72rem; color: var(--muted); font-weight: 600; }
  .mini-field input, .mini-field select { width: 100%; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; font-size: .86rem; font-family: inherit; background: var(--surface); color: var(--text); }
  .mini-field input:focus, .mini-field select:focus { outline: none; border-color: var(--accent); }
  .selected-guests { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow-y: auto; }
  .selected-empty { font-size: .82rem; color: var(--muted); padding: 8px 0; }
  .guest-row { display: flex; align-items: center; gap: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); padding: 7px 8px; font-size: .82rem; }
  .guest-row-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .guest-row button { border: none; background: transparent; color: var(--muted); cursor: pointer; line-height: 1; padding: 2px; }
  .guest-row button:hover { color: var(--danger); }
  .unassigned-panel { min-width: 0; }
  .panel-badge { background: var(--accent-soft); color: var(--gold-txt); font-size: .75rem; padding: 2px 8px; border-radius: 10px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .panel-search { width: 100%; padding: 8px 12px; border: none; border-bottom: 1px solid var(--border); font-size: .88rem; font-family: inherit; outline: none; background: var(--surface); color: var(--text); }
  .panel-search:focus { border-bottom-color: var(--accent); }
  .unassigned-list { padding: 8px; max-height: clamp(220px, 40vh, 480px); overflow-y: auto; }
  .unassigned-chip { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; margin: 2px 0; background: var(--bg); cursor: grab; font-size: .85rem; }
  .unassigned-chip:active { cursor: grabbing; }
  .unassigned-chip:hover { border-color: var(--accent); background: var(--surface-2); }
  .panel-group-title { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 10px 4px 4px; border-top: 1px solid var(--border); margin-top: 4px; display: flex; justify-content: space-between; align-items: center; }
  .panel-group-title:first-child { border-top: none; margin-top: 0; padding-top: 4px; }
  .panel-group-count { font-size: .7rem; background: var(--border-soft); color: var(--muted); border-radius: 8px; padding: 1px 7px; font-weight: 600; }
  .unc-sec { font-size: .68rem; padding: 1px 6px; border-radius: 8px; font-weight: 600; white-space: nowrap; }
  .sec-sposo  { background: var(--info-soft); color: var(--info); }
  .sec-sposa  { background: var(--purple-soft); color: var(--purple); }
  .sec-comuni { background: var(--success-soft); color: var(--success); }
  .sec-sposi  { background: var(--accent-soft); color: var(--gold-txt); }
  .empty-panel { text-align: center; color: var(--muted); font-size: .82rem; padding: 20px; }
  .assign-hint { font-size: .78rem; color: var(--muted); padding: 6px 10px 2px; }
  .mini-bar { display: block; height: 4px; border-radius: 2px; background: var(--border-soft); overflow: hidden; margin-top: 7px; }
  .mini-bar > i { display: block; height: 100%; border-radius: 2px; background: var(--success); }
  .mini-bar.near > i { background: var(--warning); }
  .mini-bar.full > i { background: var(--danger); }
  .tables-list-card { margin-top: 18px; }
  .tables-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; padding: 14px; }
  .table-list-item { border: 1px solid var(--border); border-radius: 10px; background: var(--surface); padding: 11px 12px; display: flex; align-items: center; gap: 10px; cursor: pointer; }
  .table-list-item:hover { border-color: var(--accent); background: var(--surface-2); }
  .shape-dot { width: 30px; height: 30px; border: 2px solid var(--accent); background: var(--accent-soft); flex: none; }
  .shape-dot.round { border-radius: 999px; }
  .shape-dot.rect { border-radius: 6px; width: 38px; }
  .table-list-main { flex: 1; min-width: 0; }
  .table-list-name { font-weight: 700; font-size: .88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .table-list-sub { color: var(--muted); font-size: .76rem; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .sheet-overlay { position: fixed; inset: 0; z-index: 1000; background: color-mix(in srgb, var(--bg) 55%, transparent); backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; }
  .sheet { background: var(--surface); border: 1px solid var(--border); border-radius: 16px 16px 0 0; box-shadow: var(--shadow-lg); width: 100%; max-width: 520px; max-height: 80vh; overflow-y: auto; padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); animation: fadeUp .2s ease both; }
  .sheet-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--border); margin: 8px auto 12px; }
  .sheet-title { font-weight: 700; font-size: 1rem; margin-bottom: 2px; }
  .sheet-sub { font-size: .82rem; color: var(--muted); margin-bottom: 12px; }
  .sheet-opt { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; text-align: left; padding: 13px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-family: inherit; font-size: .92rem; cursor: pointer; margin-bottom: 8px; }
  .sheet-opt:hover:not(:disabled) { border-color: var(--accent); }
  .sheet-opt.current { border-color: var(--accent); background: var(--accent-soft); }
  .sheet-opt:disabled { opacity: .5; cursor: not-allowed; }
  .sheet-opt .seats { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; font-size: .78rem; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .sheet-opt .seats .mini-bar { width: 64px; margin: 0; }
  .sheet-opt.danger { color: var(--danger); border-color: var(--danger-soft); }
  @media (min-width: 600px) { .sheet-overlay { align-items: center; } .sheet { border-radius: 16px; } }
  @media (max-width: 1100px) {
    .layout { grid-template-columns: 1fr; }
    /* auto-fit: i pannelli si affiancano quando c'è spazio, uno solo occupa tutta la riga */
    .room-side { position: static; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  }
  @media (max-width: 760px) { .room-viewport { height: 450px; min-height: 450px; } .room-hint { display: none; } .table-edit-grid { grid-template-columns: 1fr; } }
  @media print { .layout { grid-template-columns: 1fr; } .room-side, .chip-remove, .toolbar, .add-form, .room-toolbar .btn, .room-toggle, .tables-list-card { display: none !important; } .room-viewport { height: 720px; min-height: 720px; border: 1px solid #ddd; } .room-card { box-shadow: none; } }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Tavoli</h1>
  <div class="header-actions">
    <button class="btn btn-ghost btn-sm" onclick="window.print()" title="Stampa la sala">🖨 Stampa</button>
    <button class="icon-btn" id="theme-toggle">🌙</button>
  </div>
</header>
<div class="container container--wide">
  <details class="collapsible">
    <summary>📊 Riepilogo tavoli</summary>
    <div class="summary">
      <div class="stat-card"><div class="val" id="s-tavoli">0</div><div class="lbl">Tavoli</div></div>
      <div class="stat-card"><div class="val" id="s-posti">0</div><div class="lbl">Posti totali</div></div>
      <div class="stat-card"><div class="val" id="s-assegnati">0</div><div class="lbl">Assegnati</div></div>
      <div class="stat-card warn"><div class="val" id="s-non-assegnati">0</div><div class="lbl">Non assegnati</div></div>
    </div>
  </details>
  <div class="toolbar">
    <button class="btn btn-primary" onclick="toggleAddForm()">+ Nuovo tavolo</button>
  </div>
  <div class="add-form" id="add-form">
    <h3>Nuovo tavolo</h3>
    <div class="form-row">
      <div class="form-group"><label>N° posti</label><input type="number" id="f-posti" min="1" max="50" value="10" style="width:80px" /></div>
      <div class="form-group"><label>Forma</label><select id="f-shape"><option value="round">Rotondo</option><option value="rect">Rettangolare</option></select></div>
      <button class="btn btn-primary" onclick="addTavolo()">Crea</button>
      <button class="btn btn-ghost" onclick="toggleAddForm()">Annulla</button>
    </div>
  </div>
  <div class="layout">
    <div class="room-main">
      <div class="room-card">
        <div class="room-toolbar">
          <div>
            <div class="room-title">Sala grafica</div>
            <div class="room-hint">Trascina i tavoli per disporli, lo sfondo per muoverti; rotellina o +/− per lo zoom.</div>
          </div>
          <div class="room-tools no-print">
            <button class="btn btn-sm btn-ghost" id="btn-zoom-out" title="Riduci zoom" aria-label="Riduci zoom">−</button>
            <span class="room-zoom" id="room-zoom-label">100%</span>
            <button class="btn btn-sm btn-ghost" id="btn-zoom-in" title="Aumenta zoom" aria-label="Aumenta zoom">+</button>
            <button class="btn btn-sm btn-ghost" id="btn-fit-room" title="Adatta la sala alla finestra">Adatta</button>
            <label class="room-toggle"><input type="checkbox" id="room-snap" /> Snap griglia</label>
          </div>
        </div>
        <div class="room-viewport" id="room-viewport">
          <div class="room-world" id="room-world"></div>
        </div>
      </div>
      <div class="tables-list-card">
        <div class="side-header"><span>Lista tavoli</span><span class="room-hint">Click per selezionare nella sala</span></div>
        <div class="tables-list" id="tables-list"></div>
      </div>
    </div>
    <div class="room-side no-print">
      <div class="selected-panel" id="selected-panel">
        <div class="side-header">
          <span class="side-title"><span id="selected-title">Tavolo</span><span class="panel-badge" id="selected-occ">0/0</span></span>
          <button class="btn btn-sm btn-danger" id="btn-delete-selected" title="Elimina tavolo">✕</button>
        </div>
        <div class="side-body">
          <div class="table-edit-grid">
            <div class="mini-field"><label>Posti</label><input id="sel-posti" type="number" min="1" max="50" /></div>
            <div class="mini-field"><label>Forma</label><select id="sel-shape"><option value="round">Rotondo</option><option value="rect">Rettangolare</option></select></div>
            <div class="mini-field full" id="rotation-field"><label>Rotazione</label><input id="sel-rotation" type="range" min="0" max="330" step="15" /></div>
          </div>
          <div class="selected-guests" id="selected-guests"></div>
        </div>
      </div>
      <div class="unassigned-panel">
        <div class="panel-header"><span>🪑 Non assegnati</span><span class="panel-badge" id="badge-non-assegnati">0</span></div>
        <input class="panel-search" id="search-unassigned" type="text" placeholder="Cerca invitato..." oninput="renderUnassigned()" />
        <div class="assign-hint">Trascina un ospite su un tavolo oppure toccalo per scegliere.</div>
        <div class="unassigned-list" id="unassigned-list"></div>
      </div>
    </div>
  </div>
</div>
<div id="toast"></div>
`;

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const { uid, esc, toast } = App;

  const ROOM_W = 1800;
  const ROOM_H = 1100;
  const GRID = 40;
  const MAX_SEAT_DOTS = 36;
  const DEFAULT_LAYOUT = { zoom: 0.72, panX: 32, panY: 32, snap: true };
  const TIPO_LABEL = { adulto: 'Adulto', bambino: 'Bambino', neonato: 'Neonato' };

  let data = { tavoli: [], tableOrder: [], layout: { ...DEFAULT_LAYOUT } };
  let selectedTid = null;
  let roomPointer = null;
  let hadSavedLayout = false;
  let printPrevLayout = null;

  function save() { DS.set('ds_tavoli', data); }
  function tableShape(t) { return t.shape === 'rect' ? 'rect' : 'round'; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function snapCoord(v) { return data.layout.snap ? Math.round(v / GRID) * GRID : Math.round(v); }
  function orderedTavoli() { return data.tableOrder.map(id => data.tavoli.find(t => t.id === id)).filter(Boolean); }
  function tableNumber(t) { return Math.max(1, data.tableOrder.indexOf(t.id) + 1); }
  function occState(occ, posti) { return occ >= posti ? 'full' : (posti - occ <= 2 ? 'near' : ''); }
  function occBar(occ, posti) {
    const pct = posti ? Math.min(100, Math.round(occ / posti * 100)) : 0;
    return `<span class="mini-bar ${occState(occ, posti)}"><i style="width:${pct}%"></i></span>`;
  }
  function liberiLabel(n) { return n === 1 ? '1 libero' : n + ' liberi'; }
  function tipoChip(g) {
    const tipo = TIPO_LABEL[g.tipo] ? g.tipo : 'adulto';
    return `<span class="chip-tipo chip-${tipo}" title="${TIPO_LABEL[tipo]}">${tipo[0].toUpperCase()}</span>`;
  }

  function ensureLayout() {
    if (!data.layout || typeof data.layout !== 'object') data.layout = { ...DEFAULT_LAYOUT };
    data.layout.zoom = clamp(Number(data.layout.zoom) || DEFAULT_LAYOUT.zoom, 0.35, 1.6);
    data.layout.panX = Number.isFinite(Number(data.layout.panX)) ? Number(data.layout.panX) : DEFAULT_LAYOUT.panX;
    data.layout.panY = Number.isFinite(Number(data.layout.panY)) ? Number(data.layout.panY) : DEFAULT_LAYOUT.panY;
    data.layout.snap = data.layout.snap !== false;
  }

  function defaultPosition(i) {
    const cols = 5;
    return { x: 220 + (i % cols) * 230, y: 190 + Math.floor(i / cols) * 210 };
  }

  function normalizeTables() {
    const seen = new Set();
    data.tavoli.forEach((t, i) => {
      if (!t.id || seen.has(t.id)) t.id = uid();
      seen.add(t.id);
      if (!Array.isArray(t.guestIds)) t.guestIds = [];
      t.posti = clamp(parseInt(t.posti, 10) || 10, 1, 50);
      delete t.nome;
      t.shape = tableShape(t);
      t.rotation = clamp(parseInt(t.rotation, 10) || 0, 0, 330);
      const pos = defaultPosition(i);
      t.x = clamp(Number.isFinite(Number(t.x)) ? Number(t.x) : pos.x, 80, ROOM_W - 80);
      t.y = clamp(Number.isFinite(Number(t.y)) ? Number(t.y) : pos.y, 80, ROOM_H - 80);
    });
    const valid = new Set(data.tavoli.map(t => t.id));
    data.tableOrder = (Array.isArray(data.tableOrder) ? data.tableOrder : []).filter(id => valid.has(id));
    data.tavoli.forEach(t => { if (!data.tableOrder.includes(t.id)) data.tableOrder.push(t.id); });
  }

  function load() {
    const d = DS.get('ds_tavoli');
    if (d) data = d;
    hadSavedLayout = !!(d && d.layout);
    if (!Array.isArray(data.tavoli)) data.tavoli = [];
    if (!Array.isArray(data.tableOrder)) data.tableOrder = data.tavoli.map(t => t.id);
    ensureLayout();
    normalizeTables();
    cleanupOrphans();
    if (selectedTid && !data.tavoli.some(t => t.id === selectedTid)) selectedTid = null;
  }

  function cleanupOrphans() {
    const validIds = new Set(getConfirmati().map(g => g.id));
    let removed = 0;
    data.tavoli.forEach(t => {
      const before = (t.guestIds || []).length;
      t.guestIds = (t.guestIds || []).filter(id => validIds.has(id));
      removed += before - t.guestIds.length;
    });
    if (removed > 0) {
      DS.set('ds_tavoli', data);
      toast(removed + (removed === 1 ? ' ospite non più confermato rimosso dai tavoli' : ' ospiti non più confermati rimossi dai tavoli'));
    }
  }

  function getConfirmati() {
    const inv = DS.get('ds_invitati');
    if (!inv) return [];
    const list = [];
    if (inv.sposi && Array.isArray(inv.sposi.guests)) {
      inv.sposi.guests.forEach(guest => {
        if (!guest.formale && guest.status === 'confermato')
          list.push({ ...guest, sec: 'sposi', groupName: 'Sposi', groupId: 'sposi' });
      });
    }
    ['sposo','sposa','comuni'].forEach(sec => {
      if (!inv[sec] || !Array.isArray(inv[sec].groups)) return;
      inv[sec].groups.forEach(g => (g.guests || []).forEach(guest => {
        if (!guest.formale && guest.status === 'confermato')
          list.push({ ...guest, sec, groupName: g.name, groupId: g.id });
      }));
    });
    return list;
  }

  function guestMap() {
    const map = {};
    getConfirmati().forEach(g => { map[g.id] = g; });
    return map;
  }

  function getAssignedIds() {
    const ids = new Set();
    data.tavoli.forEach(t => (t.guestIds || []).forEach(id => ids.add(id)));
    return ids;
  }

  function toggleAddForm() {
    const f = $('#add-form');
    f.classList.toggle('open');
    if (f.classList.contains('open')) $('#f-posti').focus();
  }

  function addTavolo() {
    const posti = clamp(parseInt($('#f-posti').value, 10) || 10, 1, 50);
    const shape = $('#f-shape').value === 'rect' ? 'rect' : 'round';
    const viewport = $('#room-viewport');
    const rect = viewport.getBoundingClientRect();
    const cx = clamp((-data.layout.panX + rect.width / 2) / data.layout.zoom, 100, ROOM_W - 100);
    const cy = clamp((-data.layout.panY + rect.height / 2) / data.layout.zoom, 100, ROOM_H - 100);
    const t = { id: uid(), posti, shape, rotation: 0, x: snapCoord(cx), y: snapCoord(cy), guestIds: [] };
    data.tavoli.push(t);
    data.tableOrder.push(t.id);
    selectedTid = t.id;
    save(); renderAll(); toggleAddForm();
    $('#f-shape').value = 'round';
    toast('Tavolo ' + tableNumber(t) + ' creato');
  }

  function deleteTavolo(id) {
    if (!confirm('Eliminare il tavolo? Gli ospiti torneranno non assegnati.')) return;
    data.tavoli = data.tavoli.filter(t => t.id !== id);
    data.tableOrder = data.tableOrder.filter(i => i !== id);
    if (selectedTid === id) selectedTid = null;
    save(); renderAll(); toast('Tavolo eliminato');
  }

  function resizeTavolo(id, val) {
    const t = data.tavoli.find(t => t.id === id);
    if (t) { t.posti = clamp(parseInt(val, 10) || 1, 1, 50); save(); renderAll(); }
  }

  function setTableShape(id, val) {
    const t = data.tavoli.find(t => t.id === id);
    if (!t) return;
    t.shape = val === 'rect' ? 'rect' : 'round';
    if (t.shape === 'round') t.rotation = 0;
    save(); renderAll();
  }

  function rotateTable(id, val) {
    const t = data.tavoli.find(t => t.id === id);
    if (!t) return;
    t.rotation = clamp(parseInt(val, 10) || 0, 0, 330);
    save(); renderAll();
  }

  function selectTable(id, { center = false } = {}) {
    selectedTid = id;
    if (center) centerOnTable(id);
    renderAll();
  }

  function removeGuest(tavoloId, guestId) {
    const t = data.tavoli.find(t => t.id === tavoloId);
    if (!t) return;
    t.guestIds = t.guestIds.filter(id => id !== guestId);
    save(); renderAll();
  }

  function assignGuest(tavoloId, guestId) {
    data.tavoli.forEach(t => { t.guestIds = (t.guestIds || []).filter(id => id !== guestId); });
    const t = data.tavoli.find(t => t.id === tavoloId);
    if (!t) return;
    if ((t.guestIds || []).length >= t.posti) { toast('Tavolo al completo'); renderAll(); return; }
    t.guestIds.push(guestId);
    selectedTid = t.id;
    save(); renderAll();
  }

  function updateSummary() {
    const confermati = getConfirmati();
    const assigned   = getAssignedIds();
    const totPosti   = data.tavoli.reduce((s,t) => s + (t.posti || 0), 0);
    $('#s-tavoli').textContent        = data.tavoli.length;
    $('#s-posti').textContent         = totPosti;
    $('#s-assegnati').textContent     = assigned.size;
    const nonAss = confermati.filter(g => !assigned.has(g.id)).length;
    $('#s-non-assegnati').textContent = nonAss;
    $('#badge-non-assegnati').textContent = nonAss;
  }

  function setWorldTransform() {
    const world = $('#room-world');
    world.style.transform = `translate(${data.layout.panX}px, ${data.layout.panY}px) scale(${data.layout.zoom})`;
    $('#room-viewport').classList.toggle('zoom-far', data.layout.zoom < 0.5);
    $('#room-zoom-label').textContent = Math.round(data.layout.zoom * 100) + '%';
    $('#room-snap').checked = !!data.layout.snap;
  }

  function worldPoint(ev) {
    const rect = $('#room-viewport').getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left - data.layout.panX) / data.layout.zoom,
      y: (ev.clientY - rect.top - data.layout.panY) / data.layout.zoom,
    };
  }

  /* Zoom centrato su un punto della viewport (default: il centro), così la
     vista non "scappa" quando si zooma con la rotellina sul puntatore. */
  function zoomRoom(delta, cx, cy) {
    const rect = $('#room-viewport').getBoundingClientRect();
    if (cx == null) { cx = rect.width / 2; cy = rect.height / 2; }
    const old = data.layout.zoom;
    const nz = clamp(Math.round((old + delta) * 100) / 100, 0.35, 1.6);
    if (nz === old) return;
    const wx = (cx - data.layout.panX) / old;
    const wy = (cy - data.layout.panY) / old;
    data.layout.panX = Math.round(cx - wx * nz);
    data.layout.panY = Math.round(cy - wy * nz);
    data.layout.zoom = nz;
    save(); setWorldTransform();
  }

  function fitRoom({ persist = true } = {}) {
    const rect = $('#room-viewport').getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const zoom = clamp(Math.min((rect.width - 24) / ROOM_W, (rect.height - 24) / ROOM_H), 0.35, 1.6);
    data.layout.zoom = Math.round(zoom * 100) / 100;
    data.layout.panX = Math.round((rect.width - ROOM_W * data.layout.zoom) / 2);
    data.layout.panY = Math.round((rect.height - ROOM_H * data.layout.zoom) / 2);
    if (persist) save();
    setWorldTransform();
  }

  function centerOnTable(id) {
    const t = data.tavoli.find(t => t.id === id);
    const viewport = $('#room-viewport');
    if (!t || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    data.layout.panX = Math.round(rect.width / 2 - t.x * data.layout.zoom);
    data.layout.panY = Math.round(rect.height / 2 - t.y * data.layout.zoom);
    save();
  }

  /* In stampa la sala esce sempre intera: fit temporaneo sull'area di stampa
     (720px di altezza, vedi @media print), ripristinato subito dopo. */
  function onBeforePrint() {
    printPrevLayout = { ...data.layout };
    const rect = $('#room-viewport').getBoundingClientRect();
    const w = rect.width || 700;
    const h = 720;
    data.layout.zoom = Math.min((w - 24) / ROOM_W, (h - 24) / ROOM_H);
    data.layout.panX = Math.round((w - ROOM_W * data.layout.zoom) / 2);
    data.layout.panY = Math.round((h - ROOM_H * data.layout.zoom) / 2);
    setWorldTransform();
  }
  function onAfterPrint() {
    if (!printPrevLayout) return;
    data.layout = printPrevLayout;
    printPrevLayout = null;
    setWorldTransform();
  }

  /* Posizioni delle sedie lungo il perimetro del tavolo, nel sistema di
     coordinate del contenitore .room-table (ruota insieme al tavolo). */
  function seatPositions(shape, n) {
    const pts = [];
    if (shape === 'round') {
      const r = 67;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
        pts.push({ x: 64 + Math.cos(a) * r, y: 64 + Math.sin(a) * r });
      }
    } else {
      const w = 162, h = 110, P = 2 * (w + h);
      for (let i = 0; i < n; i++) {
        let d = (w / 2 + (i / n) * P) % P;
        let x, y;
        if (d < w) { x = d - w / 2; y = -h / 2; }
        else if ((d -= w) < h) { x = w / 2; y = d - h / 2; }
        else if ((d -= h) < w) { x = w / 2 - d; y = h / 2; }
        else { d -= w; x = -w / 2; y = h / 2 - d; }
        pts.push({ x: 78 + x, y: 56 + y });
      }
    }
    return pts;
  }

  function seatDotsHtml(t) {
    const occ = (t.guestIds || []).length;
    const n = Math.min(t.posti, MAX_SEAT_DOTS);
    // Se i posti superano il tetto di pallini, gli occupati scalano in proporzione.
    const filled = occ ? Math.max(1, Math.min(n, Math.round(occ / t.posti * n))) : 0;
    return seatPositions(tableShape(t), n)
      .map((p, i) => `<span class="seat${i < filled ? ' occ' : ''}" style="left:${p.x.toFixed(1)}px;top:${p.y.toFixed(1)}px"></span>`)
      .join('');
  }

  function renderRoom() {
    const world = $('#room-world');
    world.innerHTML = '';
    setWorldTransform();
    if (!data.tavoli.length) {
      const empty = document.createElement('div');
      empty.className = 'room-empty';
      empty.textContent = 'Crea un tavolo per iniziare a disporre la sala.';
      world.appendChild(empty);
      return;
    }
    const sposiIds = new Set(getConfirmati().filter(g => g.sec === 'sposi').map(g => g.id));
    orderedTavoli().forEach(t => world.appendChild(buildRoomTable(t, sposiIds)));
  }

  function buildRoomTable(t, sposiIds) {
    const occupati = (t.guestIds || []).length;
    const full = occupati >= t.posti;
    const isSposi = (t.guestIds || []).some(id => sposiIds.has(id));
    const el = document.createElement('div');
    el.className = 'room-table shape-' + tableShape(t)
      + (full ? ' is-full' : '')
      + (isSposi ? ' is-sposi' : '')
      + (selectedTid === t.id ? ' selected' : '');
    el.dataset.tid = t.id;
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.style.transform = `translate(-50%, -50%) rotate(${t.rotation || 0}deg)`;
    el.style.setProperty('--unrot', (-(t.rotation || 0)) + 'deg');
    el.innerHTML = `
      ${seatDotsHtml(t)}
      <div class="table-shape">
        <div class="table-center">
          <span class="table-number">${tableNumber(t)}</span>
          <span class="table-occ ${occState(occupati, t.posti)}" title="${occupati} su ${t.posti}, ${liberiLabel(Math.max(0, t.posti - occupati))}">${occupati}/${t.posti}</span>
          ${isSposi ? '<br><span class="table-tag">💍 Sposi</span>' : ''}
        </div>
      </div>`;
    el.addEventListener('pointerdown', e => startTableDrag(e, t.id));
    el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', e => {
      e.preventDefault(); el.classList.remove('drag-over');
      const gid = e.dataTransfer.getData('guestId');
      if (gid) assignGuest(t.id, gid);
    });
    return el;
  }

  function startTableDrag(e, id) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const t = data.tavoli.find(t => t.id === id);
    if (!t) return;
    selectedTid = id;
    const p = worldPoint(e);
    const pointerId = e.pointerId;
    const target = e.currentTarget;
    target.setPointerCapture(pointerId);
    const start = { x: t.x, y: t.y, px: p.x, py: p.y, moved: false };

    const move = ev => {
      const q = worldPoint(ev);
      const dx = q.x - start.px;
      const dy = q.y - start.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true;
      t.x = clamp(snapCoord(start.x + dx), 60, ROOM_W - 60);
      t.y = clamp(snapCoord(start.y + dy), 60, ROOM_H - 60);
      target.style.left = t.x + 'px';
      target.style.top = t.y + 'px';
    };
    const up = () => {
      target.releasePointerCapture(pointerId);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      save();
      if (!start.moved) renderAll(); else renderSelectedPanel();
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  function startRoomPan(e) {
    if (e.button != null && e.button !== 0) return;
    if (e.target.closest('.room-table')) return;
    e.preventDefault();
    const viewport = $('#room-viewport');
    viewport.classList.add('dragging');
    selectedTid = null;
    const pointerId = e.pointerId;
    viewport.setPointerCapture(pointerId);
    roomPointer = { x: e.clientX, y: e.clientY, panX: data.layout.panX, panY: data.layout.panY };
    const move = ev => {
      data.layout.panX = Math.round(roomPointer.panX + ev.clientX - roomPointer.x);
      data.layout.panY = Math.round(roomPointer.panY + ev.clientY - roomPointer.y);
      setWorldTransform();
    };
    const up = () => {
      viewport.classList.remove('dragging');
      viewport.releasePointerCapture(pointerId);
      viewport.removeEventListener('pointermove', move);
      viewport.removeEventListener('pointerup', up);
      viewport.removeEventListener('pointercancel', up);
      roomPointer = null;
      save(); renderSelectedPanel(); renderTablesList();
    };
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
  }

  function renderSelectedPanel() {
    const panel = $('#selected-panel');
    const t = data.tavoli.find(t => t.id === selectedTid);
    if (!t) { panel.classList.remove('show'); return; }
    panel.classList.add('show');
    const occ = (t.guestIds || []).length;
    $('#selected-title').textContent = 'Tavolo ' + tableNumber(t);
    $('#selected-occ').textContent = occ + '/' + t.posti;
    $('#sel-posti').value = t.posti;
    $('#sel-shape').value = tableShape(t);
    $('#sel-rotation').value = t.rotation || 0;
    $('#rotation-field').style.display = tableShape(t) === 'rect' ? '' : 'none';

    const wrap = $('#selected-guests');
    const gMap = guestMap();
    const guests = (t.guestIds || []).map(id => gMap[id]).filter(Boolean);
    if (!guests.length) {
      wrap.innerHTML = '<div class="selected-empty">Nessun invitato assegnato. Trascina qui gli ospiti dal pannello sotto.</div>';
      return;
    }
    wrap.innerHTML = '';
    guests.forEach(g => {
      const row = document.createElement('div');
      row.className = 'guest-row';
      row.innerHTML = `${tipoChip(g)}<span class="guest-row-name">${esc(g.name)}</span><button onclick="removeGuest('${t.id}','${g.id}')" title="Rimuovi">✕</button>`;
      wrap.appendChild(row);
    });
  }

  function renderTablesList() {
    const wrap = $('#tables-list');
    if (!data.tavoli.length) {
      wrap.innerHTML = '<div class="empty-panel">Nessun tavolo creato.</div>';
      return;
    }
    wrap.innerHTML = '';
    orderedTavoli().forEach(t => {
      const occ = (t.guestIds || []).length;
      const liberi = Math.max(0, t.posti - occ);
      const item = document.createElement('div');
      item.className = 'table-list-item';
      item.title = 'Seleziona nella sala';
      item.innerHTML = `
        <span class="shape-dot ${tableShape(t)}"></span>
        <div class="table-list-main">
          <div class="table-list-name">Tavolo ${tableNumber(t)}</div>
          <div class="table-list-sub">${occ}/${t.posti} · ${liberiLabel(liberi)} · ${tableShape(t) === 'rect' ? 'rettangolare' : 'rotondo'}</div>
          ${occBar(occ, t.posti)}
        </div>`;
      item.addEventListener('click', () => selectTable(t.id, { center: true }));
      item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('drop', e => { e.preventDefault(); const gid = e.dataTransfer.getData('guestId'); if (gid) assignGuest(t.id, gid); });
      wrap.appendChild(item);
    });
  }

  function renderUnassigned() {
    const confermati = getConfirmati();
    const assigned   = getAssignedIds();
    const q = ($('#search-unassigned').value || '').toLowerCase();
    const list = confermati.filter(g => !assigned.has(g.id) && g.name.toLowerCase().includes(q));
    const ul = $('#unassigned-list');

    if (!list.length) {
      ul.innerHTML = `<div class="empty-panel">${confermati.length === 0 ? 'Nessun invitato confermato in Invitati' : 'Tutti assegnati'}</div>`;
      return;
    }

    const groups = new Map();
    list.forEach(g => {
      const key = g.groupId;
      if (!groups.has(key)) groups.set(key, { name: g.groupName, sec: g.sec, guests: [] });
      groups.get(key).guests.push(g);
    });

    ul.innerHTML = '';
    groups.forEach(({ name, sec, guests }) => {
      const hdr = document.createElement('div');
      hdr.className = 'panel-group-title';
      hdr.innerHTML = `<span>${esc(name)} <span class="unc-sec sec-${sec}" style="margin-left:4px">${sec}</span></span><span class="panel-group-count">${guests.length}</span>`;
      ul.appendChild(hdr);

      guests.forEach(g => {
        const chip = document.createElement('div');
        chip.className = 'unassigned-chip';
        chip.draggable = true;
        chip.dataset.gid = g.id;
        chip.innerHTML = `${tipoChip(g)}<span style="flex:1">${esc(g.name)}</span>`;
        chip.addEventListener('dragstart', e => {
          e.dataTransfer.setData('guestId', g.id);
          e.dataTransfer.effectAllowed = 'move';
        });
        chip.addEventListener('click', () => openAssignPicker(g.id));
        ul.appendChild(chip);
      });
    });
  }

  function openAssignPicker(guestId) {
    const g = getConfirmati().find(x => x.id === guestId);
    if (!g) return;
    let currentTid = null;
    data.tavoli.forEach(t => { if ((t.guestIds || []).includes(guestId)) currentTid = t.id; });
    const ordered = orderedTavoli();

    const opts = ordered.map(t => {
      const occ   = (t.guestIds || []).length;
      const isCur = t.id === currentTid;
      const full  = occ >= t.posti && !isCur;
      return `<button class="sheet-opt ${isCur ? 'current' : ''}" data-tid="${t.id}" ${full ? 'disabled' : ''}>
        <span>Tavolo ${tableNumber(t)}${isCur ? ' ✓' : ''}</span>
        <span class="seats"><span>${occ}/${t.posti}${full ? ' · pieno' : ''}</span>${occBar(occ, t.posti)}</span>
      </button>`;
    }).join('');

    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-handle"></div>
        <div class="sheet-title">${esc(g.name)}</div>
        <div class="sheet-sub">${currentTid ? 'Sposta in un altro tavolo o rimuovi' : 'Assegna a un tavolo'}</div>
        ${ordered.length ? opts : '<div class="sheet-sub">Nessun tavolo creato.</div>'}
        ${currentTid ? '<button class="sheet-opt danger" data-action="remove">Rimuovi dal tavolo</button>' : ''}
        <button class="sheet-opt" data-action="cancel" style="justify-content:center">Annulla</button>
      </div>`;

    function close() {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) return close();
      const btn = e.target.closest('.sheet-opt');
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'cancel') return close();
      if (action === 'remove') { removeGuest(currentTid, guestId); return close(); }
      if (btn.dataset.tid) { assignGuest(btn.dataset.tid, guestId); close(); }
    });
    document.body.appendChild(overlay);
  }

  function renderAll() {
    renderRoom();
    renderTablesList();
    renderSelectedPanel();
    renderUnassigned();
    updateSummary();
  }

  Object.assign(window, {
    toggleAddForm, addTavolo, deleteTavolo, resizeTavolo,
    removeGuest, renderUnassigned, selectTable,
  });

  $('#room-viewport').addEventListener('pointerdown', startRoomPan);
  $('#room-viewport').addEventListener('wheel', e => {
    e.preventDefault();
    const rect = $('#room-viewport').getBoundingClientRect();
    zoomRoom(e.deltaY > 0 ? -0.08 : 0.08, e.clientX - rect.left, e.clientY - rect.top);
  }, { passive: false });
  $('#btn-zoom-in').addEventListener('click', () => zoomRoom(0.1));
  $('#btn-zoom-out').addEventListener('click', () => zoomRoom(-0.1));
  $('#btn-fit-room').addEventListener('click', () => fitRoom());
  $('#room-snap').addEventListener('change', e => { data.layout.snap = e.target.checked; save(); setWorldTransform(); });
  $('#btn-delete-selected').addEventListener('click', () => { if (selectedTid) deleteTavolo(selectedTid); });
  $('#sel-posti').addEventListener('blur', e => { if (selectedTid) resizeTavolo(selectedTid, e.target.value); });
  $('#sel-shape').addEventListener('change', e => { if (selectedTid) setTableShape(selectedTid, e.target.value); });
  $('#sel-rotation').addEventListener('input', e => { if (selectedTid) rotateTable(selectedTid, e.target.value); });
  window.addEventListener('beforeprint', onBeforePrint);
  window.addEventListener('afterprint', onAfterPrint);

  load(); renderAll();
  if (!hadSavedLayout) fitRoom();
  const onChange = e => {
    if (e.detail.key === 'ds_invitati') { cleanupOrphans(); renderAll(); }
    if (e.detail.remote && e.detail.key === 'ds_tavoli') { load(); renderAll(); }
  };
  window.addEventListener('ds:change', onChange);
  return () => {
    window.removeEventListener('ds:change', onChange);
    window.removeEventListener('beforeprint', onBeforePrint);
    window.removeEventListener('afterprint', onAfterPrint);
  };
}
