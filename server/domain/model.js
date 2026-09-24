// Modello autorevole: documenti esistenti conservati, regole e default sul server.
import { DOC_KEYS } from '../../src/shared/docKeys.js';
import { DEFAULTS } from './checklist-template.js';
export { DOC_KEYS };
export const sections = ['sposo', 'sposa', 'comuni'];
export const clone = (x) => JSON.parse(JSON.stringify(x));
export function fail(message, status = 422) {
  throw Object.assign(new Error(message), { status });
}
export function object(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) fail('Oggetto non valido');
  return x;
}
export function text(x, required = false) {
  if (typeof x !== 'string' || x.length > 10000 || (required && !x.trim()))
    fail('Testo non valido');
  return x.trim();
}
export function number(x, min = 0, max = 100000000) {
  if (typeof x !== 'number' || !Number.isFinite(x) || x < min || x > max)
    fail('Numero fuori intervallo');
  return x;
}
export function id(x) {
  if (typeof x !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(x)) fail('Identificativo non valido');
  return x;
}
export function enumeration(x, values) {
  if (!values.includes(x)) fail('Valore non ammesso');
  return x;
}
export function date(x) {
  text(x);
  if (
    x &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(x) ||
      !Number.isFinite(Date.parse(x)) ||
      new Date(x).toISOString().slice(0, 10) !== x)
  )
    fail('Data non valida');
  return x;
}
const fields = {
  guest: {
    name: (x) => text(x, true),
    tipo: (x) => enumeration(x, ['adulto', 'bambino', 'neonato']),
    status: (x) => enumeration(x, ['da_invitare', 'invitato', 'confermato', 'annullato']),
    menu: (x) => enumeration(x, ['', 'carne', 'pesce', 'vegetariano', 'vegano']),
    parentela: text,
    formale: bool,
    celiaco: bool,
    lattosio: bool,
  },
  group: { name: (x) => text(x, true), type: (x) => enumeration(x, ['famiglia', 'generico']) },
  budget: {
    descrizione: (x) => text(x, true),
    categoria: text,
    preventivo: number,
    pagato: number,
    stato: (x) => enumeration(x, ['da_pagare', 'acconto', 'saldato']),
    note: text,
  },
  supplier: {
    nome: (x) => text(x, true),
    azienda: text,
    categoria: text,
    telefono: text,
    email: text,
    sito: text,
    preventivo: number,
    importo: number,
    stato: (x) =>
      enumeration(x, ['dacontattare', 'contattato', 'preventivo', 'contratto', 'saldato']),
    note: text,
  },
  event: {
    titolo: (x) => text(x, true),
    ora: (x) => {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(x)) fail('Orario non valido');
      return x;
    },
    categoria: text,
    luogo: text,
    durata: (x) => number(x, 0, 1440),
    note: text,
  },
  task: {
    titolo: (x) => text(x, true),
    fase: text,
    categoria: text,
    priorita: (x) => enumeration(x, ['alta', 'media', 'bassa']),
    stato: (x) => enumeration(x, ['todo', 'wip', 'done']),
    scadenza: date,
    note: text,
  },
  table: {
    posti: (x) => {
      number(x, 1, 50);
      if (!Number.isInteger(x)) fail('Posti interi richiesti');
      return x;
    },
    shape: (x) => enumeration(x, ['round', 'rect']),
    rotation: (x) => number(x, 0, 330),
    x: (x) => number(x, 60, 1740),
    y: (x) => number(x, 60, 1040),
  },
  layout: {
    zoom: (x) => number(x, 0.35, 1.6),
    panX: (x) => number(x, -100000, 100000),
    panY: (x) => number(x, -100000, 100000),
    snap: bool,
  },
};
function bool(x) {
  if (typeof x !== 'boolean') fail('Valore booleano richiesto');
  return x;
}
export function patch(kind, input) {
  object(input);
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(fields[kind], key)) fail('Campo non ammesso: ' + key);
    result[key] = fields[kind][key](value);
  }
  return result;
}
export const defaults = {
  ds_invitati: {
    sposi: { id: 'sposi', name: 'Sposi', type: 'sposi', guests: [] },
    ...Object.fromEntries(sections.map((s) => [s, { groups: [], groupOrder: [] }])),
  },
  ds_prices: {
    adulto: 0,
    adultoMenu: { carne: 0, pesce: 0, vegetariano: 0, vegano: 0 },
    bambino: 0,
    neonato: 0,
  },
  ds_budget: { totale: 0, voci: [] },
  ds_fornitori: { fornitori: [] },
  ds_programma: { data: '', eventi: [], eventOrder: [] },
  ds_tavoli: { tavoli: [], tableOrder: [], layout: { zoom: 0.72, panX: 32, panY: 32, snap: true } },
  ds_checklist: {
    items: DEFAULTS.map((x, i) => ({ ...x, id: 'template_' + i, scadenza: '', note: '' })),
  },
};
export function groups(state) {
  const d = state.ds_invitati;
  return [d.sposi, ...sections.flatMap((s) => d[s].groups)];
}
export function guests(state) {
  return groups(state).flatMap((g) => g.guests);
}
export function getGroup(state, gid) {
  return groups(state).find((g) => g.id === id(gid)) || fail('Gruppo non trovato', 404);
}
export function find(list, key) {
  return list.find((x) => x.id === id(key)) || fail('Elemento non trovato', 404);
}
export function reorder(order, requested) {
  if (
    !Array.isArray(requested) ||
    requested.length !== order.length ||
    new Set(requested).size !== order.length ||
    requested.some((x) => !order.includes(x))
  )
    fail('Ordine non valido o non aggiornato', 409);
  return [...requested];
}
export function normalize(key, source) {
  const d = clone(source ?? defaults[key]);
  object(d);
  for (const [field, value] of Object.entries(defaults[key]))
    if (d[field] === undefined && !['eventOrder', 'tableOrder'].includes(field)) d[field] = clone(value);
  const array = (value) => { if (!Array.isArray(value)) fail('Elenco non valido'); return value; };
  // Migrazioni di rappresentazione non distruttive: campi storici mantenuti.
  if (key === 'ds_invitati') {
    d.sposi ??= clone(defaults.ds_invitati.sposi);
    d.sposi.id = 'sposi';
    d.sposi.type = 'sposi';
    for (const sec of sections) {
      d[sec] ??= { groups: [], groupOrder: [] };
      object(d[sec]);
      d[sec].groups ??= [];
      array(d[sec].groups);
      d[sec].groupOrder ??= d[sec].groups.map((g) => g.id);
      array(d[sec].groupOrder);
    }
    for (const g of groups({ ds_invitati: d })) {
      object(g);
      g.guests ??= [];
      array(g.guests);
      if (g.id !== 'sposi') {
        g.type ??= 'generico';
        g.capofamiglia ??= null;
      }
      for (const guest of g.guests) {
        guest.formale ??= false;
        guest.parentela ??= '';
        guest.menu ??= '';
        guest.celiaco ??= false;
        guest.lattosio ??= false;
        if (guest.menu === 'celiaco') {
          guest.celiaco = true;
          guest.menu = '';
        }
      }
    }
  }
  if (key === 'ds_prices') { d.adultoMenu ??= clone(defaults.ds_prices.adultoMenu); object(d.adultoMenu); }
  const listField = { ds_budget: 'voci', ds_fornitori: 'fornitori', ds_programma: 'eventi', ds_tavoli: 'tavoli', ds_checklist: 'items' }[key];
  if (listField) array(d[listField]).forEach(object);
  if (key === 'ds_programma') d.eventOrder ??= d.eventi.map((e) => e.id);
  if (key === 'ds_tavoli') {
    d.layout = { ...defaults.ds_tavoli.layout, ...d.layout };
    d.tavoli.forEach((t, i) => {
      t.id ??= 'legacy_table_' + i;
      t.guestIds ??= [];
      t.shape ??= 'round';
      t.rotation ??= 0;
      t.x ??= 220 + (i % 5) * 230;
      t.y ??= 190 + Math.floor(i / 5) * 210;
    });
    d.tableOrder ??= d.tavoli.map((t) => t.id);
  }
  return d;
}
export function cateringCost(state) {
  const p = state.ds_prices;
  return (
    Math.round(
      guests(state)
        .filter((g) => !g.formale && g.status !== 'annullato')
        .reduce(
          (sum, g) =>
            sum +
            (g.tipo === 'bambino'
              ? p.bambino
              : g.tipo === 'neonato'
                ? p.neonato
                : p.adultoMenu[g.menu] || p.adulto),
          0,
        ) * 100,
    ) / 100
  );
}
export function validateTables(state) {
  const valid = new Map(guests(state).map((g) => [g.id, g]));
  const assigned = new Set();
  for (const t of state.ds_tavoli.tavoli) {
    let occupied = 0;
    for (const gid of t.guestIds) {
      if (!valid.has(gid)) fail('Assegnazione a invitato inesistente');
      if (assigned.has(gid)) fail('Invitato assegnato a più tavoli');
      assigned.add(gid);
      const g = valid.get(gid);
      if (!g.formale && g.status === 'confermato') occupied++;
    }
    if (occupied > t.posti) fail('Capienza del tavolo superata');
  }
}
