import { App } from './app.js';
import { DS } from '../state/storage.js';
import { Sync } from '../state/sync.js';
import * as home from './views/home.js';
import * as invitati from './views/invitati.js';
import * as budget from './views/budget.js';
import * as fornitori from './views/fornitori.js';
import * as programma from './views/programma.js';
import * as tavoli from './views/tavoli.js';
import * as checklist from './views/checklist.js';
import * as impostazioni from './views/impostazioni.js';

const VIEWS = {
  '': home,
  invitati, budget, fornitori, programma, tavoli, checklist, impostazioni,
};

let currentUnmount = null;

function currentRoute() {
  return location.hash.replace(/^#\/?/, '');
}

export function mountRoute() {
  if (currentUnmount) { try { currentUnmount(); } catch (e) { console.error(e); } currentUnmount = null; }
  const view = VIEWS[currentRoute()] || home;
  const root = document.getElementById('app');
  if (!DS.ready) {
    root.innerHTML = '<div class="container"><h1>Day Special</h1><p>Caricamento dal server. Le modifiche saranno disponibili dopo la connessione.</p></div>';
    return;
  }
  root.innerHTML = view.html;
  document.title = view.title || 'Day Special';
  try {
    const dependencies = { invitati: ['ds_invitati', 'ds_prices'], tavoli: ['ds_tavoli', 'ds_invitati'], budget: ['ds_budget'], fornitori: ['ds_fornitori'], programma: ['ds_programma'], checklist: ['ds_checklist'] };
    const error = (dependencies[currentRoute()] || []).map(DS.documentError).find(Boolean);
    if (error) throw new Error(error);
    currentUnmount = view.mount(root) || null;
  } catch (e) {
    // Un documento malformato (arrivato dal server o da un'altra versione)
    // non deve lasciare la pagina a metà, senza header né sync: si mostra
    // una vista di cortesia e si lascia l'app navigabile.
    console.error('Errore nel montaggio della vista', currentRoute(), e);
    currentUnmount = null;
    root.innerHTML = errorHtml(e);
  }
  App.initPage();
  Sync.onViewMounted();
  window.scrollTo(0, 0);
}

function errorHtml(e) {
  const msg = App.esc(e && e.message ? e.message : String(e));
  return `
<header>
  <a class="nav-back" href="#/">← Home</a>
  <h1>Day <span>Special</span></h1>
  <div class="header-actions"><button class="icon-btn" id="theme-toggle">🌙</button></div>
</header>
<div class="container container--narrow">
  <div class="empty-state" style="text-align:left">
    <p><strong>Questa sezione non si è aperta correttamente.</strong></p>
    <p style="margin-top:8px">I dati originali sono conservati. Le altre sezioni restano disponibili.
    Prova a ricaricare la pagina; se il problema persiste, segnala questo messaggio:</p>
    <pre style="margin-top:8px;white-space:pre-wrap;font-size:.8rem;color:var(--muted)">${msg}</pre>
    <p style="margin-top:12px"><button class="btn btn-primary" onclick="location.reload()">Ricarica</button></p>
  </div>
</div>`;
}

export function startRouter() {
  window.addEventListener('hashchange', mountRoute);
  window.addEventListener('ds:ready', () => { if (!document.querySelector('header')) mountRoute(); });
  mountRoute();
}
