/**
 * Day Special – Utilità condivise (tema, toast, helpers, CSV)
 * initPage() va richiamata dal router dopo ogni mount di vista (in una SPA
 * DOMContentLoaded fa il suo dovere solo al primo avvio, non ad ogni cambio vista).
 */
export const App = (() => {

  const THEME_KEY = 'ds_theme';

  // ── Tema (applicato subito, prima del paint) ─────────────────────────────
  function currentTheme() { return localStorage.getItem(THEME_KEY) || 'light'; }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀️' : '🌙';
      btn.title = t === 'dark' ? 'Passa al tema chiaro' : 'Passa al tema scuro';
      btn.dataset.label = t === 'dark' ? 'Tema chiaro' : 'Tema scuro';
    }
  }

  function toggleTheme() {
    const t = currentTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
  }

  applyTheme(currentTheme());

  // ── Menu "Opzioni" a scomparsa (solo mobile) ────────────────────────────
  function setupHeaderMenu() {
    const header  = document.querySelector('header');
    const actions = header && header.querySelector('.header-actions');
    if (!header || !actions || header.querySelector('.menu-toggle')) return;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'menu-toggle';
    toggle.textContent = '⚙';
    toggle.title = 'Opzioni';
    toggle.setAttribute('aria-label', 'Opzioni');
    toggle.setAttribute('aria-expanded', 'false');
    header.appendChild(toggle);

    const close = () => {
      actions.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
    };

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = actions.classList.toggle('menu-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    actions.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) close();
    });

    document.addEventListener('click', (e) => {
      if (e.target !== toggle && !actions.contains(e.target)) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  // Da richiamare dal router dopo aver montato una vista: applica tema, wire
  // del bottone tema, menù header. Idempotente sul tema (nessun problema se
  // richiamata più volte); il menu-toggle viene ricreato ad ogni vista perché
  // il DOM dell'header è nuovo.
  function initPage() {
    applyTheme(currentTheme());
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggleTheme);
    setupHeaderMenu();
  }

  // ── Helpers comuni ───────────────────────────────────────────────────────
  function uid() { return '_' + Math.random().toString(36).slice(2, 9); }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmtEur(v) {
    return '€ ' + (v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Toast ────────────────────────────────────────────────────────────────
  let toastTimer;
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  // ── Export CSV (separatore ; per Excel italiano) ─────────────────────────
  function downloadCSV(filename, rows) {
    const SEP = ';';
    const escape = (cell) => {
      const s = String(cell ?? '');
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = '﻿' + rows.map(r => r.map(escape).join(SEP)).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return { toggleTheme, initPage, uid, esc, fmtEur, toast, downloadCSV };
})();

if (typeof window !== 'undefined') window.App = App;
