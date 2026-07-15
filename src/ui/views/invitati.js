import { DS } from '../../state/storage.js';
import { App } from '../app.js';

export const title = 'Invitati – Day Special';

export const html = `
<style>
  .summary { display: flex; flex-direction: column; gap: 14px; margin-bottom: 32px; }
  .stat-card.cost .val { font-size: 1.4rem; color: var(--accent-dk); }
  .menu-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 28px; box-shadow: var(--shadow); }
  .menu-section h2 { font-size: 1rem; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }
  .collapsible { padding: 0; }
  .collapsible > summary { cursor: pointer; list-style: none; display: flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 600; padding: 16px 24px; user-select: none; }
  .collapsible > summary::-webkit-details-marker { display: none; }
  .collapsible > summary::after { content: '▸'; margin-left: auto; color: var(--muted); transition: transform .2s; }
  .collapsible[open] > summary::after { transform: rotate(90deg); }
  .collapsible > summary:hover { color: var(--accent); }
  .collapsible[open] > summary { border-bottom: 1px solid var(--border); }
  .collapsible > :not(summary) { padding: 18px 24px; }
  #summary-card .summary { margin-bottom: 0; }
  .menu-prices { display: flex; gap: 16px; flex-wrap: wrap; }
  .price-field { display: flex; flex-direction: column; gap: 4px; }
  .price-field label { font-size: .8rem; color: var(--muted); font-weight: 500; }
  .price-field input { width: 130px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; font-size: .95rem; background: var(--surface); color: var(--text); }
  .price-field input:focus { outline: none; border-color: var(--accent); }
  .section-tabs { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
  .tab-btn { padding: 9px 20px; border: 1px solid var(--border); border-radius: 20px; background: var(--surface); cursor: pointer; font-size: .88rem; font-weight: 500; color: var(--muted); transition: all .18s; font-family: inherit; }
  .tab-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
  [data-theme="dark"] .tab-btn.active { color: #1c1815; }
  .tab-btn:hover:not(.active) { border-color: var(--accent); color: var(--accent); }
  .guest-section { display: none; }
  .guest-section.active { display: block; }
  .print-title { display: none; }
  .toolbar input[type=text] { flex: 1; min-width: 180px; }
  .form-row input[name=nome] { flex: 1; min-width: 160px; }
  .groups-area { display: flex; flex-direction: column; gap: 16px; }
  .family-group { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; animation: fadeUp .3s ease both; }
  .family-group.is-famiglia { border-left: 3px solid var(--accent-line); }
  .group-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); user-select: none; }
  .drag-handle { color: var(--muted); font-size: 1rem; cursor: grab; }
  .drag-handle:active { cursor: grabbing; }
  .group-collapse { background: none; border: none; cursor: pointer; color: var(--muted); font-size: .85rem; padding: 2px 4px; line-height: 1; flex: none; }
  .group-collapse:hover { color: var(--accent); }
  .family-group.collapsed .group-body { display: none; }
  .group-name-wrap { flex: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .group-name-input { border: none; background: transparent; font-weight: 600; font-size: .95rem; outline: none; border-bottom: 1px dashed var(--accent); color: var(--text); font-family: inherit; }
  .group-count { font-size: .8rem; color: var(--muted); background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 2px 10px; white-space: nowrap; }
  .group-body { padding: 8px 12px; }
  .group-toggle { display: none; background: none; border: 1px solid var(--border); border-radius: 8px; width: 30px; height: 30px; font-size: 1.1rem; line-height: 1; cursor: pointer; color: var(--muted); flex: none; }
  .group-toggle:hover { border-color: var(--accent); color: var(--accent); }
  .group-actions { display: flex; align-items: center; gap: 6px; }
  .group-type-badge { font-size: .7rem; padding: 2px 9px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
  .group-type-badge.famiglia { background: var(--gold-soft); color: var(--gold-txt); }
  .group-type-badge.generico { background: var(--bg); color: var(--muted); border: 1px solid var(--border); }
  .group-type-badge.sposi { background: var(--accent-soft); color: var(--gold-txt); }
  .capo-name { font-size: .78rem; color: var(--gold-txt); font-weight: 600; white-space: nowrap; }
  .edit-btn { background: none; border: none; cursor: pointer; font-size: .85rem; opacity: .5; padding: 2px 4px; line-height: 1; transition: opacity .15s; }
  .edit-btn:hover { opacity: 1; }
  .guest-list { list-style: none; }
  .guest-item { display: flex; align-items: center; gap: 10px; padding: 8px 6px; border-bottom: 1px solid var(--border-soft); }
  .guest-item:last-child { border-bottom: none; }
  .guest-item.dragging { opacity: .4; }
  .guest-item.formale { background: repeating-linear-gradient(135deg, transparent, transparent 6px, var(--bg) 6px, var(--bg) 12px); }
  .guest-item.formale .guest-name-input { color: var(--muted); font-style: italic; }
  .guest-item.capofamiglia { background: var(--gold-soft); }
  .guest-item.capofamiglia .guest-name-input { font-weight: 700; }
  .capo-marker { font-size: .9rem; }
  .flag-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 3px 7px; font-size: .75rem; cursor: pointer; color: var(--muted); white-space: nowrap; transition: all .15s; font-family: inherit; }
  .flag-btn:hover { border-color: var(--accent); color: var(--accent); }
  .flag-btn.active { background: var(--accent-soft); border-color: var(--accent-line); color: var(--gold-txt); font-weight: 600; }
  .crown-btn { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 3px 7px; font-size: .8rem; cursor: pointer; opacity: .4; filter: grayscale(1); transition: all .15s; }
  .crown-btn:hover { opacity: .85; filter: grayscale(0); border-color: var(--accent-line); }
  .crown-btn.active { opacity: 1; filter: none; background: var(--gold-soft); border-color: var(--accent-line); }
  .parentela-select { font-size: .8rem; padding: 4px 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text); font-family: inherit; max-width: 150px; }
  .group-move-select { font-size: .8rem; padding: 4px 6px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--muted); font-family: inherit; max-width: 150px; cursor: pointer; }
  .group-move-select:focus { outline: none; border-color: var(--accent); }
  .parentela-static { font-size: .75rem; padding: 2px 8px; border-radius: 10px; font-weight: 600; background: var(--gold-soft); color: var(--gold-txt); white-space: nowrap; }
  .guest-drag { color: var(--border); cursor: grab; font-size: .9rem; }
  .guest-drag:active { cursor: grabbing; }
  .guest-type-badge { font-size: .7rem; padding: 2px 8px; border-radius: 10px; font-weight: 600; white-space: nowrap; }
  .badge-adulto  { background: var(--info-soft); color: var(--info); }
  .badge-bambino { background: var(--success-soft); color: var(--success); }
  .badge-neonato { background: var(--gold-soft); color: var(--gold-txt); }
  .tipo-select { font-size: .72rem; padding: 3px 8px; border-radius: 10px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--border); background: var(--surface); }
  .tipo-select:focus { outline: none; border-color: var(--accent); }
  .tipo-select.tipo-adulto  { background: var(--info-soft);    color: var(--info);     border-color: var(--info-soft); }
  .tipo-select.tipo-bambino { background: var(--success-soft); color: var(--success);  border-color: var(--success-soft); }
  .tipo-select.tipo-neonato { background: var(--gold-soft);    color: var(--gold-txt); border-color: var(--gold-soft); }
  .menu-select { font-size: .72rem; padding: 3px 8px; border-radius: 10px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid var(--border); background: var(--surface); color: var(--muted); }
  .menu-select:focus { outline: none; border-color: var(--accent); }
  .menu-select.menu-carne       { background: var(--warning-soft); color: var(--warning); border-color: var(--warning-soft); }
  .menu-select.menu-pesce       { background: var(--info-soft);    color: var(--info);    border-color: var(--info-soft); }
  .menu-select.menu-vegetariano { background: var(--success-soft); color: var(--success); border-color: var(--success-soft); }
  .menu-select.menu-vegano      { background: var(--teal-soft);    color: var(--teal);    border-color: var(--teal-soft); }
  .guest-name-input { border: none; background: transparent; font-size: .9rem; outline: none; border-bottom: 1px dashed var(--accent); flex: 1; min-width: 0; color: var(--text); font-family: inherit; }
  .status-da_invitare { border-color: var(--border); color: var(--muted); }
  .status-invitato     { border-color: var(--info);    color: var(--info); }
  .status-confermato   { border-color: var(--success); color: var(--success); }
  .status-annullato    { border-color: var(--danger);  color: var(--danger); }
  .guest-main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .guest-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .guest-toggle { display: none; background: none; border: 1px solid var(--border); border-radius: 8px; width: 30px; height: 30px; font-size: 1.1rem; line-height: 1; cursor: pointer; color: var(--muted); flex: none; }
  .guest-toggle:hover { border-color: var(--accent); color: var(--accent); }
  .status-dot { display: none; width: 11px; height: 11px; border-radius: 50%; flex: none; background: var(--muted); }
  .status-dot.status-da_invitare { background: var(--muted); }
  .status-dot.status-invitato    { background: var(--info); }
  .status-dot.status-confermato  { background: var(--success); }
  .status-dot.status-annullato   { background: var(--danger); }
  .sposi-block { margin-bottom: 18px; }
  .sposi-group { border-left: 3px solid var(--accent); }
  .sposi-group .group-header { background: var(--accent-soft); padding: 8px 12px; }
  .sposi-group .group-body { padding: 4px 12px 8px; }
  .sposi-add { display: flex; gap: 8px; padding: 8px 4px 2px; flex-wrap: wrap; }
  .sposi-add input { flex: 1; min-width: 150px; padding: 7px 11px; border: 1px solid var(--border); border-radius: 8px; font-size: .9rem; background: var(--surface); color: var(--text); font-family: inherit; }
  .sposi-add input:focus { outline: none; border-color: var(--accent); }
  .group-add-wrap { padding: 6px 6px 2px; border-top: 1px dashed var(--border-soft); margin-top: 4px; }
  .group-add { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .group-add-name { flex: 1; min-width: 150px; padding: 7px 11px; border: 1px solid var(--border); border-radius: 8px; font-size: .9rem; background: var(--surface); color: var(--text); font-family: inherit; }
  .group-add-name:focus { outline: none; border-color: var(--accent); }
  .group-add-tipo { padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; font-size: .85rem; background: var(--surface); color: var(--text); font-family: inherit; }
  .group-add-tipo:focus { outline: none; border-color: var(--accent); }
  .empty-group { text-align: center; color: var(--muted); font-size: .85rem; padding: 14px; }
  .drop-target { outline: 2px dashed var(--accent); outline-offset: -2px; }
  @media (max-width: 600px) {
    .guest-item { flex-direction: column; align-items: stretch; gap: 0; padding: 10px 8px; }
    .guest-main { gap: 8px; }
    .guest-name-input { flex: 1; font-size: 16px; }
    .guest-drag, .drag-handle { display: none; }
    .guest-toggle { display: inline-flex; align-items: center; justify-content: center; }
    .status-dot { display: inline-block; }
    .guest-actions { display: none; width: 100%; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-soft); gap: 8px; }
    .guest-item.expanded .guest-actions { display: flex; }
    .guest-actions .status-select, .guest-actions .parentela-select { flex: 1; min-width: 130px; }
    .guest-actions .guest-type-badge { align-self: center; }
    .group-header { flex-wrap: wrap; gap: 8px; }
    .group-name-input { font-size: 16px; }
    .group-toggle { display: inline-flex; align-items: center; justify-content: center; }
    .group-actions { display: none; width: 100%; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-soft); }
    .family-group.expanded .group-actions { display: flex; }
  }
  @media print {
    .summary, .menu-section, .section-tabs, .sposi-add, .edit-btn { display: none; }
    .guest-section { display: block !important; }
    .print-title { display: block; font-family: var(--font-serif); font-size: 1.2rem; font-weight: 700; margin: 18px 0 10px; }
    .guest-drag, .drag-handle, .flag-btn:not(.active) { display: none; }
  }
</style>
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span> — Invitati</h1>
  <div class="header-actions">
    <button class="btn btn-ghost btn-sm" onclick="exportCSV()" title="Esporta la lista invitati in CSV">⬇ CSV</button>
    <button class="btn btn-ghost btn-sm" onclick="window.print()" title="Stampa la lista invitati">🖨 Stampa</button>
    <button class="icon-btn" id="theme-toggle">🌙</button>
  </div>
</header>
<div class="container container--wide">
  <details class="collapsible menu-section" id="summary-card">
    <summary>📊 Riepilogo invitati e costi</summary>
    <div class="summary" id="summary">
      <div class="summary-group">
        <div class="summary-group-title">👥 Totale invitati</div>
        <div class="summary-cards">
          <div class="stat-card"><div class="val" id="s-totale">0</div><div class="lbl">Totale</div></div>
          <div class="stat-card"><div class="val" id="s-adulti">0</div><div class="lbl">Adulti</div></div>
          <div class="stat-card"><div class="val" id="s-bambini">0</div><div class="lbl">Bambini</div></div>
          <div class="stat-card"><div class="val" id="s-neonati">0</div><div class="lbl">Neonati</div></div>
          <div class="stat-card" style="border-left:3px solid var(--accent-line)"><div class="val" style="color:var(--gold-txt)" id="s-formali">0</div><div class="lbl">Formali (esclusi)</div></div>
        </div>
      </div>
      <div class="summary-group">
        <div class="summary-group-title">📊 Invitati per provenienza</div>
        <div class="summary-cards">
          <div class="stat-card"><div class="val" id="s-sec-sposo">0</div><div class="lbl">💍 Sposo</div></div>
          <div class="stat-card"><div class="val" id="s-sec-sposa">0</div><div class="lbl">👰 Sposa</div></div>
          <div class="stat-card"><div class="val" id="s-sec-comuni">0</div><div class="lbl">🤝 Comuni</div></div>
          <div class="stat-card"><div class="val" id="s-sec-sposi">0</div><div class="lbl">💑 Sposi</div></div>
        </div>
      </div>
      <div class="summary-group">
        <div class="summary-group-title">🍽️ Menù</div>
        <div class="summary-cards">
          <div class="stat-card"><div class="val" id="s-menu-carne">0</div><div class="lbl">🥩 Carne</div></div>
          <div class="stat-card"><div class="val" id="s-menu-pesce">0</div><div class="lbl">🐟 Pesce</div></div>
          <div class="stat-card"><div class="val" id="s-menu-vegetariano">0</div><div class="lbl">🥗 Vegetariano</div></div>
          <div class="stat-card"><div class="val" id="s-menu-vegano">0</div><div class="lbl">🌱 Vegano</div></div>
          <div class="stat-card"><div class="val" id="s-menu-nd">0</div><div class="lbl">Da assegnare</div></div>
          <div class="stat-card" style="border-left:3px solid var(--accent-line)"><div class="val" style="color:var(--gold-txt)" id="s-celiaci">0</div><div class="lbl">🌾 Celiaci (di cui)</div></div>
          <div class="stat-card" style="border-left:3px solid var(--accent-line)"><div class="val" style="color:var(--gold-txt)" id="s-lattosio">0</div><div class="lbl">🥛 Senza lattosio (di cui)</div></div>
        </div>
      </div>
      <div class="summary-group">
        <div class="summary-group-title">📬 Stato inviti</div>
        <div class="summary-cards">
          <div class="stat-card"><div class="val" id="s-da_invitare">0</div><div class="lbl">Inviti da inviare</div></div>
          <div class="stat-card"><div class="val" id="s-invitato">0</div><div class="lbl">Inviti inviati</div></div>
          <div class="stat-card"><div class="val" id="s-confermato">0</div><div class="lbl">Confermati</div></div>
          <div class="stat-card"><div class="val" id="s-annullato">0</div><div class="lbl">Annullati</div></div>
        </div>
      </div>
      <div class="summary-group">
        <div class="summary-group-title">💰 Costi</div>
        <div class="summary-cards">
          <div class="stat-card cost"><div class="val" id="s-costo">€ 0,00</div><div class="lbl">Costo stimato</div></div>
          <div class="stat-card cost"><div class="val" id="s-costo-confermati">€ 0,00</div><div class="lbl">Costo confermati</div></div>
        </div>
      </div>
    </div>
  </details>

  <details class="collapsible menu-section">
    <summary>🍽️ Prezzo menù per persona</summary>
    <div class="menu-prices">
      <div class="price-field"><label>Adulto – base (€)</label><input type="number" id="p-adulto" min="0" step="0.01" placeholder="es. 85.00" /></div>
      <div class="price-field"><label>Adulto 🥩 Carne (€)</label><input type="number" id="p-adulto-carne" min="0" step="0.01" placeholder="—" /></div>
      <div class="price-field"><label>Adulto 🐟 Pesce (€)</label><input type="number" id="p-adulto-pesce" min="0" step="0.01" placeholder="—" /></div>
      <div class="price-field"><label>Adulto 🥗 Vegetariano (€)</label><input type="number" id="p-adulto-vegetariano" min="0" step="0.01" placeholder="—" /></div>
      <div class="price-field"><label>Adulto 🌱 Vegano (€)</label><input type="number" id="p-adulto-vegano" min="0" step="0.01" placeholder="—" /></div>
      <div class="price-field"><label>Bambino (€)</label><input type="number" id="p-bambino" min="0" step="0.01" placeholder="es. 40.00" /></div>
      <div class="price-field"><label>Neonato (€)</label><input type="number" id="p-neonato" min="0" step="0.01" placeholder="es. 0.00" /></div>
    </div>
    <p style="font-size:.8rem;color:var(--muted);margin-top:10px">
      Per gli adulti vale il prezzo della portata scelta; se quella portata è vuota (o il menù non è ancora assegnato) si usa il prezzo <strong>base</strong>.
    </p>
  </details>

  <div class="sposi-block"><div class="groups-area" id="groups-sposi"></div></div>

  <div class="section-tabs">
    <button class="tab-btn active" onclick="switchTab('sposo', this)">💍 Sposo</button>
    <button class="tab-btn" onclick="switchTab('sposa', this)">👰 Sposa</button>
    <button class="tab-btn" onclick="switchTab('comuni', this)">🤝 Comuni</button>
  </div>

  <div class="guest-section active" id="sec-sposo">
    <div class="print-title">💍 Invitati Sposo</div>
    <div class="toolbar">
      <button class="btn btn-primary" onclick="openAddForm('sposo')">+ Aggiungi Invitato</button>
      <button class="btn btn-ghost" onclick="openGroupForm('sposo')">+ Nuovo Gruppo</button>
      <button class="btn btn-ghost" onclick="toggleCollapseAll('sposo')" title="Comprimi/espandi tutti i gruppi">⊟ Comprimi gruppi</button>
    </div>
    <div class="add-form" id="group-form-sposo">
      <h3>Nuovo gruppo – Sposo</h3>
      <div class="form-row">
        <div class="form-group"><label>Tipo di gruppo</label><select id="input-group-tipo-sposo"><option value="generico">Gruppo Generico</option><option value="famiglia">Famiglia</option></select></div>
        <div class="form-group"><label>Nome del gruppo</label><input type="text" id="input-group-nome-sposo" placeholder="Es. Famiglia Rossi" /></div>
        <button class="btn btn-primary" onclick="addGroup('sposo')">Crea</button>
        <button class="btn btn-ghost" onclick="closeGroupForm('sposo')">Annulla</button>
      </div>
    </div>
    <div class="add-form" id="form-sposo">
      <h3>Nuovo invitato – Sposo</h3>
      <div class="form-row">
        <div class="form-group"><label>Nome e Cognome</label><input type="text" name="nome" placeholder="Es. Mario Rossi" id="input-nome-sposo" /></div>
        <div class="form-group"><label>Tipo</label><select id="input-tipo-sposo"><option value="adulto">Adulto</option><option value="bambino">Bambino</option><option value="neonato">Neonato</option></select></div>
        <div class="form-group"><label>Gruppo</label><select id="input-gruppo-sposo"></select></div>
        <button class="btn btn-primary" onclick="addGuest('sposo')">Aggiungi</button>
        <button class="btn btn-ghost" onclick="closeAddForm('sposo')">Annulla</button>
      </div>
    </div>
    <div class="groups-area" id="groups-sposo"></div>
  </div>

  <div class="guest-section" id="sec-sposa">
    <div class="print-title">👰 Invitati Sposa</div>
    <div class="toolbar">
      <button class="btn btn-primary" onclick="openAddForm('sposa')">+ Aggiungi Invitato</button>
      <button class="btn btn-ghost" onclick="openGroupForm('sposa')">+ Nuovo Gruppo</button>
      <button class="btn btn-ghost" onclick="toggleCollapseAll('sposa')" title="Comprimi/espandi tutti i gruppi">⊟ Comprimi gruppi</button>
    </div>
    <div class="add-form" id="group-form-sposa">
      <h3>Nuovo gruppo – Sposa</h3>
      <div class="form-row">
        <div class="form-group"><label>Tipo di gruppo</label><select id="input-group-tipo-sposa"><option value="generico">Gruppo Generico</option><option value="famiglia">Famiglia</option></select></div>
        <div class="form-group"><label>Nome del gruppo</label><input type="text" id="input-group-nome-sposa" placeholder="Es. Famiglia Bianchi" /></div>
        <button class="btn btn-primary" onclick="addGroup('sposa')">Crea</button>
        <button class="btn btn-ghost" onclick="closeGroupForm('sposa')">Annulla</button>
      </div>
    </div>
    <div class="add-form" id="form-sposa">
      <h3>Nuovo invitato – Sposa</h3>
      <div class="form-row">
        <div class="form-group"><label>Nome e Cognome</label><input type="text" name="nome" placeholder="Es. Maria Bianchi" id="input-nome-sposa" /></div>
        <div class="form-group"><label>Tipo</label><select id="input-tipo-sposa"><option value="adulto">Adulto</option><option value="bambino">Bambino</option><option value="neonato">Neonato</option></select></div>
        <div class="form-group"><label>Gruppo</label><select id="input-gruppo-sposa"></select></div>
        <button class="btn btn-primary" onclick="addGuest('sposa')">Aggiungi</button>
        <button class="btn btn-ghost" onclick="closeAddForm('sposa')">Annulla</button>
      </div>
    </div>
    <div class="groups-area" id="groups-sposa"></div>
  </div>

  <div class="guest-section" id="sec-comuni">
    <div class="print-title">🤝 Invitati Comuni</div>
    <div class="toolbar">
      <button class="btn btn-primary" onclick="openAddForm('comuni')">+ Aggiungi Invitato</button>
      <button class="btn btn-ghost" onclick="openGroupForm('comuni')">+ Nuovo Gruppo</button>
      <button class="btn btn-ghost" onclick="toggleCollapseAll('comuni')" title="Comprimi/espandi tutti i gruppi">⊟ Comprimi gruppi</button>
    </div>
    <div class="add-form" id="group-form-comuni">
      <h3>Nuovo gruppo – Comuni</h3>
      <div class="form-row">
        <div class="form-group"><label>Tipo di gruppo</label><select id="input-group-tipo-comuni"><option value="generico">Gruppo Generico</option><option value="famiglia">Famiglia</option></select></div>
        <div class="form-group"><label>Nome del gruppo</label><input type="text" id="input-group-nome-comuni" placeholder="Es. Famiglia Verdi" /></div>
        <button class="btn btn-primary" onclick="addGroup('comuni')">Crea</button>
        <button class="btn btn-ghost" onclick="closeGroupForm('comuni')">Annulla</button>
      </div>
    </div>
    <div class="add-form" id="form-comuni">
      <h3>Nuovo invitato – Comuni</h3>
      <div class="form-row">
        <div class="form-group"><label>Nome e Cognome</label><input type="text" name="nome" placeholder="Es. Luca Verdi" id="input-nome-comuni" /></div>
        <div class="form-group"><label>Tipo</label><select id="input-tipo-comuni"><option value="adulto">Adulto</option><option value="bambino">Bambino</option><option value="neonato">Neonato</option></select></div>
        <div class="form-group"><label>Gruppo</label><select id="input-gruppo-comuni"></select></div>
        <button class="btn btn-primary" onclick="addGuest('comuni')">Aggiungi</button>
        <button class="btn btn-ghost" onclick="closeAddForm('comuni')">Annulla</button>
      </div>
    </div>
    <div class="groups-area" id="groups-comuni"></div>
  </div>
</div>
<div id="toast"></div>
`;

export function mount(root) {
  const $ = (sel) => root.querySelector(sel);
  const { uid, esc: escHtml, toast } = App;

  const SECTIONS = ['sposo', 'sposa', 'comuni'];
  const SECTION_LABEL = { sposo: 'Sposo', sposa: 'Sposa', comuni: 'Comuni', sposi: 'Sposi' };
  const PARENTELE = ['Coniuge', 'Convivente', 'Figlio/a', 'Genitore', 'Fratello/Sorella',
    'Nonno/a', 'Nipote', 'Zio/a', 'Cugino/a', 'Suocero/a', 'Genero/Nuora', 'Cognato/a',
    'Altro parente', 'Amico/Ospite'];

  function emptySposi() { return { id: 'sposi', name: 'Sposi', type: 'sposi', guests: [] }; }

  function migrateDiet(gu) {
    if (gu.menu === undefined) gu.menu = '';
    if (gu.celiaco === undefined) gu.celiaco = false;
    if (gu.lattosio === undefined) gu.lattosio = false;
    if (gu.menu === 'celiaco') { gu.celiaco = true; gu.menu = ''; }
  }

  let data = {
    sposi:  emptySposi(),
    sposo:  { groups: [], groupOrder: [] },
    sposa:  { groups: [], groupOrder: [] },
    comuni: { groups: [], groupOrder: [] }
  };
  let prices = { adulto: 0, adultoMenu: { carne: 0, pesce: 0, vegetariano: 0, vegano: 0 }, bambino: 0, neonato: 0 };
  let activeTab = 'sposo';
  let addOpenGid = null;
  let collapsedGroups = new Set();

  function save() {
    DS.set('ds_invitati', data);
    DS.set('ds_prices', prices);
  }
  function load() {
    const d = DS.get('ds_invitati');
    const p = DS.get('ds_prices');
    if (d) data   = d;
    if (p) prices = p;

    if (!data.sposi || data.sposi.type !== 'sposi') data.sposi = emptySposi();
    data.sposi.id = 'sposi'; data.sposi.type = 'sposi'; data.sposi.name = 'Sposi';
    if (!Array.isArray(data.sposi.guests)) data.sposi.guests = [];
    data.sposi.guests.forEach(migrateDiet);

    SECTIONS.forEach(s => {
      if (!data[s]) data[s] = { groups: [], groupOrder: [] };
      if (!data[s].groupOrder) data[s].groupOrder = data[s].groups.map(g => g.id);
      data[s].groups.forEach(g => {
        if (!g.type) g.type = 'generico';
        if (g.capofamiglia === undefined) g.capofamiglia = null;
        g.guests.forEach(gu => {
          if (gu.parentela === undefined) gu.parentela = '';
          migrateDiet(gu);
        });
      });
    });
  }

  function findGroup(sec, gid) {
    if (sec === 'sposi') return data.sposi;
    return data[sec].groups.find(g => g.id === gid);
  }

  function loadPriceInputs() {
    const m = prices.adultoMenu || {};
    $('#p-adulto').value             = prices.adulto || '';
    $('#p-adulto-carne').value       = m.carne       || '';
    $('#p-adulto-pesce').value       = m.pesce       || '';
    $('#p-adulto-vegetariano').value = m.vegetariano || '';
    $('#p-adulto-vegano').value      = m.vegano      || '';
    $('#p-bambino').value            = prices.bambino || '';
    $('#p-neonato').value            = prices.neonato || '';
  }
  function readPrices() {
    const num = id => parseFloat($(id).value) || 0;
    prices.adulto  = num('#p-adulto');
    prices.adultoMenu = {
      carne:       num('#p-adulto-carne'),
      pesce:       num('#p-adulto-pesce'),
      vegetariano: num('#p-adulto-vegetariano'),
      vegano:      num('#p-adulto-vegano')
    };
    prices.bambino = num('#p-bambino');
    prices.neonato = num('#p-neonato');
  }

  function guestUnitPrice(g) {
    if (g.tipo === 'bambino') return prices.bambino || 0;
    if (g.tipo === 'neonato') return prices.neonato || 0;
    const m = prices.adultoMenu || {};
    return (g.menu && m[g.menu]) ? m[g.menu] : (prices.adulto || 0);
  }
  function saveAndRefresh() { readPrices(); save(); updateSummary(); }

  function switchTab(tab, btn) {
    activeTab = tab;
    root.querySelectorAll('.guest-section').forEach(s => s.classList.remove('active'));
    root.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    $('#sec-' + tab).classList.add('active');
    btn.classList.add('active');
  }

  function openAddForm(sec) {
    $('#form-' + sec).classList.add('open');
    refreshGroupSelect(sec);
    $('#input-nome-' + sec).focus();
  }
  function closeAddForm(sec) {
    $('#form-' + sec).classList.remove('open');
    $('#input-nome-' + sec).value = '';
  }

  function refreshGroupSelect(sec) {
    const sel = $('#input-gruppo-' + sec);
    const cur = sel.value;
    sel.innerHTML = '';
    orderedGroups(sec).forEach(g => {
      const o = document.createElement('option');
      o.value = g.id;
      o.textContent = g.name + (g.type === 'famiglia' ? ' (Famiglia)' : '');
      sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }

  function orderedGroups(sec) {
    const s = data[sec];
    return s.groupOrder.map(id => s.groups.find(g => g.id === id)).filter(Boolean);
  }

  function openGroupForm(sec) {
    $('#group-form-' + sec).classList.add('open');
    const inp = $('#input-group-nome-' + sec);
    inp.value = '';
    inp.focus();
    inp.onkeydown = e => { if (e.key === 'Enter') addGroup(sec); if (e.key === 'Escape') closeGroupForm(sec); };
  }
  function closeGroupForm(sec) {
    $('#group-form-' + sec).classList.remove('open');
  }
  function addGroup(sec) {
    const inp  = $('#input-group-nome-' + sec);
    const tipo = $('#input-group-tipo-' + sec).value;
    const name = (inp ? inp.value.trim() : '') ||
                 ((tipo === 'famiglia' ? 'Famiglia ' : 'Gruppo ') + (data[sec].groups.length + 1));
    const g = { id: uid(), name, type: tipo, capofamiglia: null, guests: [] };
    data[sec].groups.push(g);
    data[sec].groupOrder.push(g.id);
    save();
    closeGroupForm(sec);
    renderSection(sec);
    refreshGroupSelect(sec);
    toast('Gruppo "' + g.name + '" creato');
  }

  function moveGroup(sec, gid, dir) {
    const order = data[sec].groupOrder;
    const i = order.indexOf(gid);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    save();
    renderSection(sec);
  }

  function moveGuest(sec, gid, giid, dir) {
    const group = findGroup(sec, gid);
    if (!group) return;
    const arr = group.guests;
    const i = arr.findIndex(g => g.id === giid);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save();
    sec === 'sposi' ? renderSposi() : renderSection(sec);
  }

  function deleteGroup(sec, gid) {
    if (!confirm('Eliminare il gruppo e tutti i suoi invitati?')) return;
    data[sec].groups = data[sec].groups.filter(g => g.id !== gid);
    data[sec].groupOrder = data[sec].groupOrder.filter(id => id !== gid);
    save();
    renderSection(sec);
    toast('Gruppo eliminato');
  }

  function renameGroup(sec, gid, el) {
    const g = findGroup(sec, gid);
    if (!g || g.type === 'sposi') return;
    g.name = el.value.trim() || g.name;
    save();
    updateSummary();
  }

  function toggleGroupCollapse(sec, gid) {
    if (collapsedGroups.has(gid)) collapsedGroups.delete(gid);
    else collapsedGroups.add(gid);
    renderSection(sec);
  }
  function toggleCollapseAll(sec) {
    const ids = data[sec].groups.map(g => g.id);
    if (!ids.length) return;
    const anyExpanded = ids.some(id => !collapsedGroups.has(id));
    if (anyExpanded) ids.forEach(id => collapsedGroups.add(id));
    else ids.forEach(id => collapsedGroups.delete(id));
    renderSection(sec);
  }

  function setCapofamiglia(sec, gid, giid) {
    const group = findGroup(sec, gid);
    if (!group || group.type !== 'famiglia') return;
    group.capofamiglia = (group.capofamiglia === giid) ? null : giid;
    save();
    renderSection(sec);
    toast(group.capofamiglia ? '👑 Referente impostato' : 'Referente rimosso');
  }

  function setParentela(sec, gid, giid, val) {
    const group = findGroup(sec, gid);
    if (!group) return;
    const guest = group.guests.find(g => g.id === giid);
    if (!guest) return;
    guest.parentela = val;
    save();
  }

  function groupMoveOptions(curSec, curGid) {
    let html = '<option value="">Sposta in…</option>';
    let count = 0;
    SECTIONS.forEach(sec => {
      const groups = orderedGroups(sec).filter(g => !(sec === curSec && g.id === curGid));
      if (!groups.length) return;
      html += `<optgroup label="${SECTION_LABEL[sec]}">`;
      groups.forEach(g => {
        html += `<option value="${sec}:${g.id}">${escHtml(g.name)}${g.type === 'famiglia' ? ' (Fam.)' : ''}</option>`;
        count++;
      });
      html += '</optgroup>';
    });
    return count ? html : null;
  }

  function moveGuestToGroup(fromSec, fromGid, giid, target) {
    if (!target) return;
    const [toSec, toGid] = target.split(':');
    const src = findGroup(fromSec, fromGid);
    const dst = findGroup(toSec, toGid);
    if (!src || !dst || src === dst) return;
    const idx = src.guests.findIndex(g => g.id === giid);
    if (idx < 0) return;
    const [guest] = src.guests.splice(idx, 1);
    if (src.capofamiglia === giid) src.capofamiglia = null;
    guest.parentela = '';
    dst.guests.push(guest);
    save();
    renderAll();
    toast(guest.name + ' spostato/a in "' + dst.name + '"');
  }

  function focusGroupName(btn) {
    const inp = btn.closest('.group-header').querySelector('.group-name-input');
    if (inp) { inp.focus(); inp.select(); }
  }
  function focusGuestName(btn) {
    const inp = btn.closest('.guest-item').querySelector('.guest-name-input');
    if (inp) { inp.focus(); inp.select(); }
  }
  function toggleGuestActions(btn) {
    btn.closest('.guest-item').classList.toggle('expanded');
  }
  function toggleGroupActions(btn) {
    btn.closest('.family-group').classList.toggle('expanded');
  }

  function addGuest(sec) {
    const nome = $('#input-nome-' + sec).value.trim();
    if (!nome) { toast('Inserisci il nome dell\'invitato'); return; }
    const tipo   = $('#input-tipo-' + sec).value;
    const gid    = $('#input-gruppo-' + sec).value;
    if (!gid) { toast('Crea prima un gruppo'); return; }
    const guest  = { id: uid(), name: nome, tipo, status: 'da_invitare', formale: false, parentela: '', menu: '', celiaco: false, lattosio: false };
    const group  = data[sec].groups.find(g => g.id === gid);
    group.guests.push(guest);
    save();
    renderSection(sec);
    closeAddForm(sec);
    toast(nome + ' aggiunto/a');
  }

  function toggleGroupAdd(sec, gid) {
    addOpenGid = (addOpenGid === gid) ? null : gid;
    renderSection(sec);
    if (addOpenGid === gid) focusGroupAdd(gid);
  }
  function focusGroupAdd(gid) {
    const el = root.querySelector(`.family-group[data-gid="${gid}"] .group-add-name`);
    if (el) el.focus();
  }
  function addGuestToGroup(sec, gid) {
    const wrap = root.querySelector(`.family-group[data-gid="${gid}"] .group-add`);
    if (!wrap) return;
    const nameEl = wrap.querySelector('.group-add-name');
    const tipoEl = wrap.querySelector('.group-add-tipo');
    const nome = nameEl.value.trim();
    if (!nome) { toast('Inserisci il nome dell\'invitato'); nameEl.focus(); return; }
    const group = data[sec].groups.find(g => g.id === gid);
    if (!group) return;
    group.guests.push({ id: uid(), name: nome, tipo: tipoEl.value, status: 'da_invitare', formale: false, parentela: '', menu: '', celiaco: false, lattosio: false });
    save();
    addOpenGid = gid;
    renderSection(sec);
    focusGroupAdd(gid);
    toast(nome + ' aggiunto/a a "' + group.name + '"');
  }

  function addSpouse() {
    const inp = $('#input-sposi-nome');
    const nome = inp.value.trim();
    if (!nome) { toast('Inserisci il nome dello sposo/a'); return; }
    data.sposi.guests.push({ id: uid(), name: nome, tipo: 'adulto', status: 'confermato', formale: false, parentela: '', menu: '', celiaco: false, lattosio: false });
    save();
    renderSposi();
    inp.value = '';
    inp.focus();
    toast(nome + ' aggiunto/a agli sposi');
  }

  function deleteGuest(sec, gid, giid) {
    const group = findGroup(sec, gid);
    if (!group) return;
    group.guests = group.guests.filter(g => g.id !== giid);
    if (group.capofamiglia === giid) group.capofamiglia = null;
    save();
    sec === 'sposi' ? renderSposi() : renderSection(sec);
  }

  function updateGuestStatus(sec, gid, giid, val) {
    const group = findGroup(sec, gid);
    const guest = group.guests.find(g => g.id === giid);

    if (val === 'confermato' && guest.formale) {
      guest.formale = false;
      guest.status  = val;
      save();
      sec === 'sposi' ? renderSposi() : renderSection(sec);
      toast('⚠ ' + guest.name + ' ha confermato: rimosso da "Formali", ora incluso nei conteggi');
      return;
    }

    guest.status = val;
    const sel = root.querySelector(`[data-giid="${giid}"]`);
    if (sel) {
      applyStatusStyle(sel, val);
      const item = sel.closest('.guest-item');
      const dot  = item && item.querySelector('.status-dot');
      if (dot) dot.className = 'status-dot status-' + val;
    }
    save();
    updateSummary();
  }

  function updateGuestName(sec, gid, giid, val) {
    const group = findGroup(sec, gid);
    const guest = group.guests.find(g => g.id === giid);
    guest.name = val.trim() || guest.name;
    save();
    if (group.type === 'famiglia' && group.capofamiglia === giid) renderSection(sec);
  }

  function updateGuestTipo(sec, gid, giid, val) {
    const group = findGroup(sec, gid);
    const guest = group && group.guests.find(g => g.id === giid);
    if (!guest) return;
    guest.tipo = val;
    const sel = root.querySelector(`.guest-item[data-giid="${giid}"] .tipo-select`);
    if (sel) sel.className = 'tipo-select tipo-' + val;
    save();
    updateSummary();
  }

  function updateGuestMenu(sec, gid, giid, val) {
    const group = findGroup(sec, gid);
    const guest = group && group.guests.find(g => g.id === giid);
    if (!guest) return;
    guest.menu = val;
    const sel = root.querySelector(`.guest-item[data-giid="${giid}"] .menu-select`);
    if (sel) sel.className = 'menu-select menu-' + (val || 'none');
    save();
    updateSummary();
  }

  function toggleCeliaco(sec, gid, giid, btn) {
    const group = findGroup(sec, gid);
    const guest = group && group.guests.find(g => g.id === giid);
    if (!guest) return;
    guest.celiaco = !guest.celiaco;
    btn.classList.toggle('active', guest.celiaco);
    save();
    updateSummary();
  }

  function toggleLattosio(sec, gid, giid, btn) {
    const group = findGroup(sec, gid);
    const guest = group && group.guests.find(g => g.id === giid);
    if (!guest) return;
    guest.lattosio = !guest.lattosio;
    btn.classList.toggle('active', guest.lattosio);
    save();
    updateSummary();
  }

  function applyStatusStyle(sel, status) {
    sel.className = 'status-select status-' + status;
  }

  function toggleFormale(sec, gid, giid, btn) {
    const group = findGroup(sec, gid);
    const guest = group.guests.find(g => g.id === giid);

    if (!guest.formale && guest.status === 'confermato') {
      toast('Non puoi marcare come formale un invitato già confermato');
      return;
    }

    guest.formale = !guest.formale;
    btn.classList.toggle('active', guest.formale);
    btn.textContent = guest.formale ? '⚠ Formale' : 'Formale';
    btn.closest('.guest-item').classList.toggle('formale', guest.formale);
    save();
    updateSummary();
  }

  function allGuests() {
    const all = [];
    data.sposi.guests.forEach(g => all.push(g));
    SECTIONS.forEach(sec => {
      data[sec].groups.forEach(g => g.guests.forEach(guest => all.push(guest)));
    });
    return all;
  }

  function updateSummary() {
    const all = allGuests();
    const reali  = all.filter(g => !g.formale);
    const count  = (list, fn) => list.filter(fn).length;
    const cost   = (guests) => guests.reduce((s, g) => s + guestUnitPrice(g), 0);

    $('#s-totale').textContent  = reali.length;
    $('#s-adulti').textContent  = count(reali, g => g.tipo === 'adulto');
    $('#s-bambini').textContent = count(reali, g => g.tipo === 'bambino');
    $('#s-neonati').textContent = count(reali, g => g.tipo === 'neonato');
    $('#s-formali').textContent = all.length - reali.length;

    const secCount = sec => data[sec].groups.reduce((n, g) => n + g.guests.filter(x => !x.formale).length, 0);
    $('#s-sec-sposo').textContent  = secCount('sposo');
    $('#s-sec-sposa').textContent  = secCount('sposa');
    $('#s-sec-comuni').textContent = secCount('comuni');
    $('#s-sec-sposi').textContent  = data.sposi.guests.filter(x => !x.formale).length;

    $('#s-menu-carne').textContent       = count(reali, g => g.menu === 'carne');
    $('#s-menu-pesce').textContent       = count(reali, g => g.menu === 'pesce');
    $('#s-menu-vegetariano').textContent = count(reali, g => g.menu === 'vegetariano');
    $('#s-menu-vegano').textContent      = count(reali, g => g.menu === 'vegano');
    $('#s-menu-nd').textContent          = count(reali, g => !g.menu);
    $('#s-celiaci').textContent          = count(reali, g => g.celiaco);
    $('#s-lattosio').textContent         = count(reali, g => g.lattosio);

    $('#s-da_invitare').textContent = count(all, g => g.status === 'da_invitare');
    $('#s-invitato').textContent    = count(all, g => g.status === 'invitato');
    $('#s-confermato').textContent  = count(all, g => g.status === 'confermato');
    $('#s-annullato').textContent   = count(all, g => g.status === 'annullato');

    $('#s-costo').textContent            = App.fmtEur(cost(reali.filter(g => g.status !== 'annullato')));
    $('#s-costo-confermati').textContent = App.fmtEur(cost(reali.filter(g => g.status === 'confermato')));
  }

  function exportCSV() {
    const STATUS_LABEL = { da_invitare: 'Invito da inviare', invitato: 'Invito inviato', confermato: 'Confermato', annullato: 'Annullato' };
    const MENU_LABEL = { carne: 'Carne', pesce: 'Pesce', vegetariano: 'Vegetariano', vegano: 'Vegano' };
    const rows = [['Sezione', 'Gruppo', 'Tipo gruppo', 'Nome', 'Tipo', 'Menù', 'Celiaco', 'Senza lattosio', 'Parentela', 'Referente', 'Stato invito', 'Formale']];

    const pushGroup = (secLabel, g) => g.guests.forEach(guest => {
      const isCapo = g.type === 'famiglia' && g.capofamiglia === guest.id;
      const tipoGruppo = g.type === 'famiglia' ? 'Famiglia' : (g.type === 'sposi' ? 'Sposi' : 'Generico');
      const parentela = isCapo ? 'Referente' : (g.type === 'famiglia' ? (guest.parentela || '') : '');
      rows.push([secLabel, g.name, tipoGruppo, guest.name, guest.tipo, MENU_LABEL[guest.menu] || '', guest.celiaco ? 'Sì' : '', guest.lattosio ? 'Sì' : '', parentela,
        isCapo ? 'Sì' : '', STATUS_LABEL[guest.status] || guest.status, guest.formale ? 'Sì' : 'No']);
    });

    pushGroup('Sposi', data.sposi);
    SECTIONS.forEach(sec => orderedGroups(sec).forEach(g => pushGroup(SECTION_LABEL[sec], g)));

    if (rows.length === 1) { toast('Nessun invitato da esportare'); return; }
    App.downloadCSV('invitati-' + new Date().toISOString().slice(0, 10) + '.csv', rows);
    toast('CSV esportato (' + (rows.length - 1) + ' invitati)');
  }

  function renderSection(sec) {
    const container = $('#groups-' + sec);
    container.innerHTML = '';
    const groups = orderedGroups(sec);
    if (!groups.length) {
      container.innerHTML = '<p style="color:var(--muted);font-size:.9rem;padding:12px 0">Nessun gruppo creato. Clicca "+ Nuovo Gruppo" per iniziare.</p>';
      updateSummary(); return;
    }
    groups.forEach(g => container.appendChild(buildGroupEl(sec, g)));
    enableGroupDrag(sec);
    updateSummary();
  }

  function renderSposi() {
    const container = $('#groups-sposi');
    container.innerHTML = '';

    const div = document.createElement('div');
    div.className = 'family-group sposi-group';
    div.dataset.gid = 'sposi';

    const g = data.sposi;
    const hdr = document.createElement('div');
    hdr.className = 'group-header';
    hdr.innerHTML = `
      <span class="group-type-badge sposi">💑 Sposi</span>
      <div class="group-name-wrap"><strong>Gli Sposi</strong></div>
      <span class="group-count">${g.guests.length} ${g.guests.length === 1 ? 'persona' : 'persone'}</span>
    `;
    div.appendChild(hdr);

    const body = document.createElement('div');
    body.className = 'group-body';
    if (g.guests.length) {
      const ul = document.createElement('ul');
      ul.className = 'guest-list';
      ul.dataset.sec = 'sposi';
      ul.dataset.gid = 'sposi';
      g.guests.forEach(guest => ul.appendChild(buildGuestEl('sposi', g, guest)));
      body.appendChild(ul);
      enableGuestDrag(ul, 'sposi', 'sposi');
    } else {
      body.innerHTML = '<div class="empty-group">Aggiungi i due sposi qui sotto</div>';
    }

    if (g.guests.length < 2) {
      const add = document.createElement('div');
      add.className = 'sposi-add';
      add.innerHTML = `
        <input type="text" id="input-sposi-nome" placeholder="Nome dello sposo / della sposa" />
        <button class="btn btn-sm btn-primary" onclick="addSpouse()">+ Aggiungi</button>
      `;
      body.appendChild(add);
    }
    div.appendChild(body);
    container.appendChild(div);

    const inp = $('#input-sposi-nome');
    if (inp) inp.onkeydown = e => { if (e.key === 'Enter') addSpouse(); };

    updateSummary();
  }

  function buildGroupEl(sec, g) {
    const isCollapsed = collapsedGroups.has(g.id);
    const div = document.createElement('div');
    div.className = 'family-group' + (g.type === 'famiglia' ? ' is-famiglia' : '') + (isCollapsed ? ' collapsed' : '');
    div.dataset.gid = g.id;

    const typeBadge = g.type === 'famiglia'
      ? '<span class="group-type-badge famiglia">👪 Famiglia</span>'
      : '<span class="group-type-badge generico">Gruppo</span>';

    let capoName = '';
    if (g.type === 'famiglia' && g.capofamiglia) {
      const capo = g.guests.find(x => x.id === g.capofamiglia);
      if (capo) capoName = `<span class="capo-name" title="Referente">👑 ${escHtml(capo.name)}</span>`;
    }

    const hdr = document.createElement('div');
    hdr.className = 'group-header';
    hdr.innerHTML = `
      <span class="drag-handle" title="Trascina per riordinare">⠿</span>
      <button class="group-collapse" title="${isCollapsed ? 'Espandi la lista' : 'Comprimi la lista'}" onclick="toggleGroupCollapse('${sec}','${g.id}')">${isCollapsed ? '▸' : '▾'}</button>
      <div class="group-name-wrap">
        <input class="group-name-input" value="${escHtml(g.name)}"
          onblur="renameGroup('${sec}','${g.id}',this)"
          onkeydown="if(event.key==='Enter')this.blur()" />
        <button class="edit-btn" title="Rinomina il gruppo" onclick="focusGroupName(this)">✏️</button>
        ${typeBadge}
        ${capoName}
        <span class="group-count">${g.guests.length} invitat${g.guests.length === 1 ? 'o' : 'i'}</span>
      </div>
      <button class="group-toggle" title="Opzioni gruppo" onclick="toggleGroupActions(this)">⋯</button>
      <div class="group-actions">
        <button class="btn btn-sm btn-ghost" onclick="moveGroup('${sec}','${g.id}',-1)" title="Sposta su">▲</button>
        <button class="btn btn-sm btn-ghost" onclick="moveGroup('${sec}','${g.id}',1)" title="Sposta giù">▼</button>
        <button class="btn btn-sm btn-danger" onclick="deleteGroup('${sec}','${g.id}')" title="Elimina gruppo">✕</button>
      </div>
    `;
    div.appendChild(hdr);

    const body = document.createElement('div');
    body.className = 'group-body';
    if (!g.guests.length) {
      body.innerHTML = '<div class="empty-group">Nessun invitato in questo gruppo</div>';
    } else {
      const ul = document.createElement('ul');
      ul.className = 'guest-list';
      ul.dataset.sec = sec;
      ul.dataset.gid = g.id;
      g.guests.forEach(guest => ul.appendChild(buildGuestEl(sec, g, guest)));
      body.appendChild(ul);
      enableGuestDrag(ul, sec, g.id);
    }

    const isAddOpen = addOpenGid === g.id;
    const addUI = document.createElement('div');
    addUI.className = 'group-add-wrap';
    addUI.innerHTML = isAddOpen ? `
      <div class="group-add">
        <input type="text" class="group-add-name" placeholder="Nome e cognome"
          onkeydown="if(event.key==='Enter')addGuestToGroup('${sec}','${g.id}');else if(event.key==='Escape')toggleGroupAdd('${sec}','${g.id}')" />
        <select class="group-add-tipo"><option value="adulto">Adulto</option><option value="bambino">Bambino</option><option value="neonato">Neonato</option></select>
        <button class="btn btn-sm btn-primary" onclick="addGuestToGroup('${sec}','${g.id}')">Aggiungi</button>
        <button class="btn btn-sm btn-ghost" onclick="toggleGroupAdd('${sec}','${g.id}')">Chiudi</button>
      </div>` : `
      <button class="btn btn-sm btn-ghost group-add-btn" onclick="toggleGroupAdd('${sec}','${g.id}')">＋ Aggiungi invitato</button>`;
    body.appendChild(addUI);

    div.appendChild(body);
    return div;
  }

  function buildGuestEl(sec, g, guest) {
    const gid = g.id;
    const li = document.createElement('li');
    li.className = 'guest-item';
    li.draggable = false;
    li.dataset.giid = guest.id;

    const isFamiglia = g.type === 'famiglia';
    const isSposi    = g.type === 'sposi';
    const isCapo     = isFamiglia && g.capofamiglia === guest.id;
    if (isCapo) li.classList.add('capofamiglia');
    if (guest.formale) li.classList.add('formale');

    const crownBtn = isFamiglia ? `
      <button class="crown-btn ${isCapo ? 'active' : ''}"
        title="${isCapo ? 'È il referente (clic per rimuovere)' : 'Imposta come referente'}"
        onclick="setCapofamiglia('${sec}','${gid}','${guest.id}')">👑</button>` : '';

    let parentelaCell = '';
    if (isFamiglia) {
      if (isCapo) {
        parentelaCell = '<span class="parentela-static" title="Referente">Referente</span>';
      } else {
        const opts = ['<option value="">— Parentela —</option>']
          .concat(PARENTELE.map(p => `<option value="${p}" ${guest.parentela === p ? 'selected' : ''}>${p}</option>`))
          .join('');
        parentelaCell = `<select class="parentela-select" title="Parentela rispetto al referente"
          onchange="setParentela('${sec}','${gid}','${guest.id}',this.value)">${opts}</select>`;
      }
    }

    const moveOpts   = isSposi ? null : groupMoveOptions(sec, gid);
    const moveSelect = moveOpts
      ? `<select class="group-move-select" title="Sposta in un altro gruppo"
           onchange="moveGuestToGroup('${sec}','${gid}','${guest.id}',this.value)">${moveOpts}</select>`
      : '';

    const formaleBtn = isSposi ? '' : `
      <button class="flag-btn ${guest.formale ? 'active' : ''}" title="Invitato formale: escluso dai conteggi"
        onclick="toggleFormale('${sec}','${gid}','${guest.id}',this)">
        ${guest.formale ? '⚠ Formale' : 'Formale'}
      </button>`;

    li.innerHTML = `
      <div class="guest-main">
        <span class="guest-drag" title="Trascina">⠿</span>
        ${isCapo ? '<span class="capo-marker" title="Referente">👑</span>' : ''}
        <input class="guest-name-input" value="${escHtml(guest.name)}"
          onblur="updateGuestName('${sec}','${gid}','${guest.id}',this.value)"
          onkeydown="if(event.key==='Enter')this.blur()" />
        <span class="status-dot status-${guest.status}" title="Stato invito"></span>
        <button class="guest-toggle" title="Opzioni invitato" onclick="toggleGuestActions(this)">⋯</button>
      </div>
      <div class="guest-actions">
        <select class="tipo-select tipo-${guest.tipo}" title="Età / tipo invitato"
          onchange="updateGuestTipo('${sec}','${gid}','${guest.id}',this.value)">
          <option value="adulto"  ${guest.tipo === 'adulto'  ? 'selected' : ''}>Adulto</option>
          <option value="bambino" ${guest.tipo === 'bambino' ? 'selected' : ''}>Bambino</option>
          <option value="neonato" ${guest.tipo === 'neonato' ? 'selected' : ''}>Neonato</option>
        </select>
        <select class="menu-select menu-${guest.menu || 'none'}" title="Tipo di menù"
          onchange="updateGuestMenu('${sec}','${gid}','${guest.id}',this.value)">
          <option value=""            ${!guest.menu                    ? 'selected' : ''}>🍽️ Menù…</option>
          <option value="carne"       ${guest.menu === 'carne'        ? 'selected' : ''}>🥩 Carne</option>
          <option value="pesce"       ${guest.menu === 'pesce'        ? 'selected' : ''}>🐟 Pesce</option>
          <option value="vegetariano" ${guest.menu === 'vegetariano'  ? 'selected' : ''}>🥗 Vegetariano</option>
          <option value="vegano"      ${guest.menu === 'vegano'       ? 'selected' : ''}>🌱 Vegano</option>
        </select>
        <button class="flag-btn ${guest.celiaco ? 'active' : ''}" title="Celiaco (senza glutine)"
          onclick="toggleCeliaco('${sec}','${gid}','${guest.id}',this)">🌾 Celiaco</button>
        <button class="flag-btn ${guest.lattosio ? 'active' : ''}" title="Intollerante al lattosio (senza lattosio)"
          onclick="toggleLattosio('${sec}','${gid}','${guest.id}',this)">🥛 Senza lattosio</button>
        <button class="edit-btn" title="Rinomina l'invitato" onclick="focusGuestName(this)">✏️</button>
        ${crownBtn}
        ${parentelaCell}
        ${moveSelect}
        <select class="status-select status-${guest.status}" data-giid="${guest.id}"
          onchange="updateGuestStatus('${sec}','${gid}','${guest.id}',this.value)">
          <option value="da_invitare" ${guest.status === 'da_invitare' ? 'selected' : ''}>Invito da inviare</option>
          <option value="invitato"    ${guest.status === 'invitato' ? 'selected' : ''}>Invito inviato</option>
          <option value="confermato"  ${guest.status === 'confermato' ? 'selected' : ''}>Confermato</option>
          <option value="annullato"   ${guest.status === 'annullato' ? 'selected' : ''}>Annullato</option>
        </select>
        ${formaleBtn}
        <button class="flag-btn" onclick="moveGuest('${sec}','${gid}','${guest.id}',-1)" title="Sposta su">▲</button>
        <button class="flag-btn" onclick="moveGuest('${sec}','${gid}','${guest.id}',1)" title="Sposta giù">▼</button>
        <button class="btn btn-sm btn-danger" onclick="deleteGuest('${sec}','${gid}','${guest.id}')">✕</button>
      </div>
    `;
    return li;
  }

  function enableGroupDrag(sec) {
    const container = $('#groups-' + sec);
    const groups = container.querySelectorAll('.family-group');
    let dragging = null;

    groups.forEach(el => {
      const handle = el.querySelector('.drag-handle');
      if (handle) {
        handle.addEventListener('mousedown',  () => { el.draggable = true; });
        handle.addEventListener('touchstart', () => { el.draggable = true; }, { passive: true });
      }

      el.addEventListener('dragstart', e => {
        dragging = el;
        setTimeout(() => el.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        el.draggable = false;
        container.querySelectorAll('.family-group').forEach(g => g.classList.remove('drop-target'));
        dragging = null;
        const newOrder = [...container.querySelectorAll('.family-group')].map(g => g.dataset.gid);
        data[sec].groupOrder = newOrder;
        save();
      });
      el.addEventListener('dragover', e => {
        e.preventDefault();
        if (!dragging || dragging === el) return;
        el.classList.add('drop-target');
        const rect = el.getBoundingClientRect();
        const mid  = rect.top + rect.height / 2;
        if (e.clientY < mid) container.insertBefore(dragging, el);
        else container.insertBefore(dragging, el.nextSibling);
      });
      el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
      el.addEventListener('drop', e => { e.preventDefault(); el.classList.remove('drop-target'); });
    });
  }

  function enableGuestDrag(ul, sec, gid) {
    let dragging = null;

    ul.querySelectorAll('.guest-item').forEach(li => {
      const handle = li.querySelector('.guest-drag');
      if (handle) {
        handle.addEventListener('mousedown',  () => { li.draggable = true; });
        handle.addEventListener('touchstart', () => { li.draggable = true; }, { passive: true });
      }

      li.addEventListener('dragstart', e => {
        dragging = li;
        setTimeout(() => li.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
      });
      li.addEventListener('dragend', () => {
        li.classList.remove('dragging');
        li.draggable = false;
        ul.querySelectorAll('.guest-item').forEach(i => i.classList.remove('drop-target'));
        dragging = null;
        const group = findGroup(sec, gid);
        const newOrder = [...ul.querySelectorAll('.guest-item')].map(i => i.dataset.giid);
        group.guests = newOrder.map(id => group.guests.find(g => g.id === id)).filter(Boolean);
        save();
      });
      li.addEventListener('dragover', e => {
        e.preventDefault(); e.stopPropagation();
        if (!dragging || dragging === li) return;
        li.classList.add('drop-target');
        const rect = li.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) ul.insertBefore(dragging, li);
        else ul.insertBefore(dragging, li.nextSibling);
      });
      li.addEventListener('dragleave', () => li.classList.remove('drop-target'));
      li.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); li.classList.remove('drop-target'); });
    });
  }

  function renderAll() {
    renderSposi();
    SECTIONS.forEach(renderSection);
  }

  Object.assign(window, {
    switchTab, openAddForm, closeAddForm, addGroup, openGroupForm, closeGroupForm,
    toggleCollapseAll, toggleGroupCollapse, moveGroup, moveGuest, deleteGroup, renameGroup,
    setCapofamiglia, setParentela, moveGuestToGroup, focusGroupName, focusGuestName,
    toggleGuestActions, toggleGroupActions, addGuest, toggleGroupAdd, addGuestToGroup,
    addSpouse, deleteGuest, updateGuestStatus, updateGuestName, updateGuestTipo,
    updateGuestMenu, toggleCeliaco, toggleLattosio, toggleFormale, exportCSV,
  });

  // Prezzi menù: salvataggio live (oninput) come nella pagina originale.
  ['#p-adulto','#p-adulto-carne','#p-adulto-pesce','#p-adulto-vegetariano','#p-adulto-vegano','#p-bambino','#p-neonato']
    .forEach(sel => $(sel).addEventListener('input', saveAndRefresh));

  load();
  loadPriceInputs();
  renderAll();

  const onChange = e => {
    if (!e.detail.remote) return;
    if (e.detail.key === 'ds_invitati' || e.detail.key === 'ds_prices') {
      load(); loadPriceInputs(); renderAll();
    }
  };
  window.addEventListener('ds:change', onChange);
  return () => window.removeEventListener('ds:change', onChange);
}
