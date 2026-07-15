import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Tavoli – Day Special';

export const html = `
<style>
  .layout { display: grid; grid-template-columns: 1fr 280px; gap: 24px; align-items: start; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  .tavoli-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap: 18px; }
  .tavolo-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; animation: fadeUp .3s ease both; }
  .tavolo-card.drag-over { outline: 2px dashed var(--accent); }
  .tavolo-header { background: var(--surface-2); border-bottom: 1px solid var(--border); padding: 12px 16px; display: flex; align-items: center; gap: 8px; }
  .tavolo-nome-input { font-weight: 700; font-size: .95rem; flex: 1; min-width: 0; border: none; background: transparent; outline: none; border-bottom: 1px dashed transparent; color: var(--text); font-family: inherit; }
  .tavolo-nome-input:focus { border-bottom-color: var(--accent); }
  .tavolo-posti { font-size: .78rem; color: var(--muted); white-space: nowrap; }
  .posti-full { color: var(--danger); font-weight: 700; }
  .tavolo-body { padding: 10px 14px; min-height: 60px; }
  .guest-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--border-soft); border: 1px solid var(--border); border-radius: 16px; padding: 3px 10px 3px 8px; font-size: .8rem; margin: 3px; cursor: default; }
  .guest-chip .chip-tipo { font-size: .65rem; padding: 1px 5px; border-radius: 8px; font-weight: 600; }
  .chip-adulto  { background: var(--info-soft); color: var(--info); }
  .chip-bambino { background: var(--success-soft); color: var(--success); }
  .chip-neonato { background: var(--gold-soft); color: var(--gold-txt); }
  .chip-remove { cursor: pointer; color: var(--muted); font-size: .85rem; border: none; background: none; padding: 0; line-height: 1; }
  .chip-remove:hover { color: var(--danger); }
  .tavolo-empty { font-size: .82rem; color: var(--muted); padding: 8px 4px; text-align: center; font-style: italic; }
  .tavolo-posti-input { width: 44px; padding: 2px 4px; border: 1px solid var(--border); border-radius: 4px; font-size: .85rem; text-align: center; background: var(--surface); color: var(--text); }
  .tavolo-posti-input:focus { outline: none; border-color: var(--accent); }
  .unassigned-panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; position: sticky; top: 84px; }
  .panel-header { background: var(--surface-2); border-bottom: 1px solid var(--border); padding: 12px 16px; font-weight: 700; font-size: .9rem; display: flex; align-items: center; justify-content: space-between; }
  .panel-badge { background: var(--accent-soft); color: var(--gold-txt); font-size: .75rem; padding: 2px 8px; border-radius: 10px; font-weight: 700; }
  .panel-search { width: 100%; padding: 8px 12px; border: none; border-bottom: 1px solid var(--border); font-size: .88rem; font-family: inherit; outline: none; background: var(--surface); color: var(--text); }
  .panel-search:focus { border-bottom-color: var(--accent); }
  .unassigned-list { padding: 8px; max-height: 70vh; overflow-y: auto; }
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
  .guest-chip { cursor: pointer; }
  .unassigned-chip { cursor: pointer; }
  .assign-hint { font-size: .78rem; color: var(--muted); padding: 6px 10px 2px; }
  .sheet-overlay { position: fixed; inset: 0; z-index: 1000; background: color-mix(in srgb, var(--bg) 55%, transparent); backdrop-filter: blur(3px); display: flex; align-items: flex-end; justify-content: center; }
  .sheet { background: var(--surface); border: 1px solid var(--border); border-radius: 16px 16px 0 0; box-shadow: var(--shadow-lg); width: 100%; max-width: 520px; max-height: 80vh; overflow-y: auto; padding: 8px 16px calc(16px + env(safe-area-inset-bottom)); animation: fadeUp .2s ease both; }
  .sheet-handle { width: 40px; height: 4px; border-radius: 2px; background: var(--border); margin: 8px auto 12px; }
  .sheet-title { font-weight: 700; font-size: 1rem; margin-bottom: 2px; }
  .sheet-sub { font-size: .82rem; color: var(--muted); margin-bottom: 12px; }
  .sheet-opt { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; text-align: left; padding: 13px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-family: inherit; font-size: .92rem; cursor: pointer; margin-bottom: 8px; }
  .sheet-opt:hover:not(:disabled) { border-color: var(--accent); }
  .sheet-opt.current { border-color: var(--accent); background: var(--accent-soft); }
  .sheet-opt:disabled { opacity: .5; cursor: not-allowed; }
  .sheet-opt .seats { font-size: .78rem; color: var(--muted); white-space: nowrap; }
  .sheet-opt.danger { color: var(--danger); border-color: var(--danger-soft); }
  @media (min-width: 600px) { .sheet-overlay { align-items: center; } .sheet { border-radius: 16px; } }
  @media print { .layout { grid-template-columns: 1fr; } .unassigned-panel, .chip-remove, .tavolo-posti-input { display: none; } }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Tavoli</h1>
  <div class="header-actions">
    <button class="btn btn-ghost btn-sm" onclick="window.print()" title="Stampa la disposizione tavoli">🖨 Stampa</button>
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
      <div class="form-group"><label>Nome tavolo</label><input type="text" id="f-nome" placeholder="Es. Tavolo degli sposi" /></div>
      <div class="form-group"><label>N° posti</label><input type="number" id="f-posti" min="1" max="30" value="10" style="width:80px" /></div>
      <button class="btn btn-primary" onclick="addTavolo()">Crea</button>
      <button class="btn btn-ghost" onclick="toggleAddForm()">Annulla</button>
    </div>
  </div>
  <div class="layout">
    <div><div class="tavoli-grid" id="tavoli-grid"></div></div>
    <div class="no-print">
      <div class="unassigned-panel">
        <div class="panel-header"><span>🪑 Non assegnati</span><span class="panel-badge" id="badge-non-assegnati">0</span></div>
        <input class="panel-search" id="search-unassigned" type="text" placeholder="Cerca invitato..." oninput="renderUnassigned()" />
        <div class="assign-hint">Tocca un ospite per assegnarlo a un tavolo (oppure trascinalo).</div>
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

  let data = { tavoli: [], tableOrder: [] };

  function save() { DS.set('ds_tavoli', data); }
  function load() {
    const d = DS.get('ds_tavoli');
    if (d) data = d;
    if (!data.tavoli) data.tavoli = [];
    if (!data.tableOrder) data.tableOrder = data.tavoli.map(t => t.id);
    cleanupOrphans();
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
    if (inv.sposi && inv.sposi.guests) {
      inv.sposi.guests.forEach(guest => {
        if (!guest.formale && guest.status === 'confermato')
          list.push({ ...guest, sec: 'sposi', groupName: 'Sposi', groupId: 'sposi' });
      });
    }
    ['sposo','sposa','comuni'].forEach(sec => {
      if (!inv[sec]) return;
      inv[sec].groups.forEach(g => g.guests.forEach(guest => {
        if (!guest.formale && guest.status === 'confermato')
          list.push({ ...guest, sec, groupName: g.name, groupId: g.id });
      }));
    });
    return list;
  }

  function getAssignedIds() {
    const ids = new Set();
    data.tavoli.forEach(t => (t.guestIds||[]).forEach(id => ids.add(id)));
    return ids;
  }

  function toggleAddForm() {
    const f = $('#add-form');
    f.classList.toggle('open');
    if (f.classList.contains('open')) $('#f-nome').focus();
  }

  function addTavolo() {
    const nome  = $('#f-nome').value.trim() || ('Tavolo ' + (data.tavoli.length + 1));
    const posti = parseInt($('#f-posti').value) || 10;
    const t = { id: uid(), nome, posti, guestIds: [] };
    data.tavoli.push(t);
    data.tableOrder.push(t.id);
    save(); renderAll(); toggleAddForm();
    $('#f-nome').value = '';
    toast('Tavolo "' + nome + '" creato');
  }

  function deleteTavolo(id) {
    if (!confirm('Eliminare il tavolo? Gli ospiti torneranno non assegnati.')) return;
    data.tavoli = data.tavoli.filter(t => t.id !== id);
    data.tableOrder = data.tableOrder.filter(i => i !== id);
    save(); renderAll(); toast('Tavolo eliminato');
  }

  function renameTavolo(id, val) {
    const t = data.tavoli.find(t => t.id === id);
    if (t && val.trim()) { t.nome = val.trim(); save(); }
  }

  function resizeTavolo(id, val) {
    const t = data.tavoli.find(t => t.id === id);
    if (t) { t.posti = parseInt(val)||1; save(); renderAll(); }
  }

  function removeGuest(tavoloId, guestId) {
    const t = data.tavoli.find(t => t.id === tavoloId);
    if (!t) return;
    t.guestIds = t.guestIds.filter(id => id !== guestId);
    save(); renderAll();
  }

  function assignGuest(tavoloId, guestId) {
    data.tavoli.forEach(t => { t.guestIds = (t.guestIds||[]).filter(id => id !== guestId); });
    const t = data.tavoli.find(t => t.id === tavoloId);
    if (!t) return;
    if ((t.guestIds||[]).length >= t.posti) { toast('Tavolo al completo!'); renderAll(); return; }
    if (!t.guestIds) t.guestIds = [];
    t.guestIds.push(guestId);
    save(); renderAll();
  }

  function updateSummary() {
    const confermati = getConfirmati();
    const assigned   = getAssignedIds();
    const totPosti   = data.tavoli.reduce((s,t) => s + (t.posti||0), 0);
    $('#s-tavoli').textContent        = data.tavoli.length;
    $('#s-posti').textContent         = totPosti;
    $('#s-assegnati').textContent     = assigned.size;
    const nonAss = confermati.filter(g => !assigned.has(g.id)).length;
    $('#s-non-assegnati').textContent = nonAss;
    $('#badge-non-assegnati').textContent = nonAss;
  }

  function renderAll() { renderTavoli(); renderUnassigned(); updateSummary(); }

  function renderTavoli() {
    const grid = $('#tavoli-grid');
    if (!data.tavoli.length) {
      grid.innerHTML = '<div style="color:var(--muted);font-size:.9rem;padding:20px 0">Nessun tavolo creato. Clicca "+ Nuovo tavolo" per iniziare.</div>';
      return;
    }
    const confermati = getConfirmati();
    const gMap = {};
    confermati.forEach(g => gMap[g.id] = g);

    grid.innerHTML = '';
    const ordered = data.tableOrder.map(id => data.tavoli.find(t => t.id === id)).filter(Boolean);
    ordered.forEach(t => {
      const card = document.createElement('div');
      card.className = 'tavolo-card';
      card.dataset.tid = t.id;
      const occupati = (t.guestIds||[]).length;
      const full = occupati >= t.posti;
      const postiLabel = `${occupati}/${t.posti} posti`;

      card.innerHTML = `
        <div class="tavolo-header">
          <input class="tavolo-nome-input" value="${esc(t.nome)}"
            onblur="renameTavolo('${t.id}',this.value)"
            onkeydown="if(event.key==='Enter')this.blur()" />
          <input class="tavolo-posti-input" type="number" value="${t.posti}" min="1" max="50"
            title="Numero posti"
            onblur="resizeTavolo('${t.id}',this.value)"
            onkeydown="if(event.key==='Enter')this.blur()" />
          <span class="tavolo-posti ${full?'posti-full':''}">${postiLabel}</span>
          <button class="btn btn-sm btn-danger" onclick="deleteTavolo('${t.id}')">✕</button>
        </div>
        <div class="tavolo-body" id="tbody-${t.id}"></div>`;

      const body = card.querySelector(`#tbody-${t.id}`);
      if (!(t.guestIds||[]).length) {
        body.innerHTML = '<div class="tavolo-empty">Trascina gli ospiti qui</div>';
      } else {
        (t.guestIds||[]).forEach(gid => {
          const g = gMap[gid];
          if (!g) return;
          const chip = document.createElement('span');
          chip.className = 'guest-chip';
          chip.title = 'Tocca per spostare o rimuovere';
          chip.innerHTML = `<span class="chip-tipo chip-${g.tipo}">${g.tipo[0].toUpperCase()}</span>${esc(g.name)}<button class="chip-remove" onclick="event.stopPropagation();removeGuest('${t.id}','${gid}')" title="Rimuovi">✕</button>`;
          chip.addEventListener('click', () => openAssignPicker(gid));
          body.appendChild(chip);
        });
      }

      card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', e => {
        e.preventDefault(); card.classList.remove('drag-over');
        const gid = e.dataTransfer.getData('guestId');
        if (gid) assignGuest(t.id, gid);
      });
      grid.appendChild(card);
    });
  }

  function renderUnassigned() {
    const confermati = getConfirmati();
    const assigned   = getAssignedIds();
    const q = ($('#search-unassigned').value||'').toLowerCase();
    const list = confermati.filter(g => !assigned.has(g.id) && g.name.toLowerCase().includes(q));
    const ul = $('#unassigned-list');

    if (!list.length) {
      ul.innerHTML = `<div class="empty-panel">${confermati.length === 0 ? 'Nessun invitato confermato in Invitati' : 'Tutti assegnati ✓'}</div>`;
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
        chip.innerHTML = `<span class="chip-tipo chip-${g.tipo}">${g.tipo[0].toUpperCase()}</span><span style="flex:1">${esc(g.name)}</span>`;
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
    const ordered = data.tableOrder.map(id => data.tavoli.find(t => t.id === id)).filter(Boolean);

    const opts = ordered.map(t => {
      const occ   = (t.guestIds || []).length;
      const isCur = t.id === currentTid;
      const full  = occ >= t.posti && !isCur;
      return `<button class="sheet-opt ${isCur ? 'current' : ''}" data-tid="${t.id}" ${full ? 'disabled' : ''}>
        <span>${esc(t.nome)}${isCur ? ' ✓' : ''}</span>
        <span class="seats">${occ}/${t.posti}${full ? ' · pieno' : ''}</span>
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

    const close = () => overlay.remove();
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

  Object.assign(window, {
    toggleAddForm, addTavolo, deleteTavolo, renameTavolo, resizeTavolo,
    removeGuest, renderUnassigned,
  });

  load(); renderAll();
  const onChange = e => {
    if (e.detail.key === 'ds_invitati') { cleanupOrphans(); renderAll(); }
    if (e.detail.remote && e.detail.key === 'ds_tavoli') { load(); renderAll(); }
  };
  window.addEventListener('ds:change', onChange);
  return () => window.removeEventListener('ds:change', onChange);
}
