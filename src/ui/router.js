import { App } from './app.js';
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
  root.innerHTML = view.html;
  document.title = view.title || 'Day Special';
  currentUnmount = view.mount(root) || null;
  App.initPage();
  Sync.onViewMounted();
  window.scrollTo(0, 0);
}

export function startRouter() {
  window.addEventListener('hashchange', mountRoute);
  mountRoute();
}
