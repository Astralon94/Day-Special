import { randomUUID } from 'node:crypto';
import { DEFAULTS } from './checklist-template.js';
import {
  sections,
  getGroup,
  guests,
  find,
  patch,
  reorder,
  id,
  object,
  text,
  number,
  date,
  enumeration,
  fail,
  cateringCost,
  validateTables,
} from './model.js';
const uuid = () => randomUUID();
export const commands = Object.create(null);
function register(name, keys, run) {
  commands[name] = { keys, run };
}
const invKeys = ['ds_invitati', 'ds_tavoli'];
function cleanup(state) {
  const valid = new Set(guests(state).map((g) => g.id));
  state.ds_tavoli.tavoli.forEach((t) => {
    t.guestIds = t.guestIds.filter((x) => valid.has(x));
  });
}
function move(order, key, dir) {
  enumeration(dir, [-1, 1]);
  const at = order.indexOf(id(key)),
    to = at + dir;
  if (at < 0) fail('Elemento non trovato', 404);
  if (to >= 0 && to < order.length) [order[at], order[to]] = [order[to], order[at]];
}
register('group.create', invKeys, (s, a) => {
  const sec = enumeration(a.section, sections),
    values = patch('group', a.values);
  const g = {
    id: uuid(),
    name: values.name || 'Gruppo ' + (s.ds_invitati[sec].groups.length + 1),
    type: values.type || 'generico',
    capofamiglia: null,
    guests: [],
  };
  s.ds_invitati[sec].groups.push(g);
  s.ds_invitati[sec].groupOrder.push(g.id);
  return { id: g.id };
});
register('group.patch', invKeys, (s, a) => {
  const g = getGroup(s, a.id);
  if (g.id === 'sposi') fail('Gruppo sposi non modificabile');
  Object.assign(g, patch('group', a.values));
  if (g.type !== 'famiglia') g.capofamiglia = null;
});
register('group.delete', invKeys, (s, a) => {
  const sec = enumeration(a.section, sections),
    d = s.ds_invitati[sec];
  find(d.groups, a.id);
  d.groups = d.groups.filter((g) => g.id !== a.id);
  d.groupOrder = d.groupOrder.filter((x) => x !== a.id);
  cleanup(s);
});
register('group.move', invKeys, (s, a) =>
  move(s.ds_invitati[enumeration(a.section, sections)].groupOrder, a.id, a.direction),
);
register('group.order', invKeys, (s, a) => {
  const d = s.ds_invitati[enumeration(a.section, sections)];
  d.groupOrder = reorder(d.groupOrder, a.ids);
});
register('group.contact', invKeys, (s, a) => {
  const g = getGroup(s, a.id);
  if (g.type !== 'famiglia') fail('Referente ammesso solo per famiglie');
  if (a.guest_id !== null) find(g.guests, a.guest_id);
  g.capofamiglia = a.guest_id;
});
register('guest.create', invKeys, (s, a) => {
  const g = getGroup(s, a.group_id),
    v = patch('guest', a.values);
  if (!v.name) fail('Nome obbligatorio');
  const guest = {
    id: uuid(),
    tipo: 'adulto',
    status: g.id === 'sposi' ? 'confermato' : 'da_invitare',
    formale: false,
    parentela: '',
    menu: '',
    celiaco: false,
    lattosio: false,
    ...v,
  };
  if (guest.status === 'confermato') guest.formale = false;
  g.guests.push(guest);
  validateTables(s);
  return { id: guest.id };
});
register('guest.patch', invKeys, (s, a) => {
  const g = find(guests(s), a.id),
    v = patch('guest', a.values);
  if (v.formale === true && (v.status || g.status) === 'confermato')
    fail('Un invitato confermato non può essere formale');
  Object.assign(g, v);
  if (g.status === 'confermato') g.formale = false;
  validateTables(s);
});
register('guest.delete', invKeys, (s, a) => {
  const g = getGroup(s, a.group_id);
  find(g.guests, a.id);
  g.guests = g.guests.filter((x) => x.id !== a.id);
  if (g.capofamiglia === a.id) g.capofamiglia = null;
  cleanup(s);
});
register('guest.transfer', invKeys, (s, a) => {
  const source = getGroup(s, a.from_group),
    target = getGroup(s, a.to_group),
    guest = find(source.guests, a.id);
  if (source === target) return;
  source.guests = source.guests.filter((g) => g.id !== a.id);
  if (source.capofamiglia === a.id) source.capofamiglia = null;
  guest.parentela = '';
  target.guests.push(guest);
});
register('guest.move', invKeys, (s, a) => {
  const g = getGroup(s, a.group_id),
    order = g.guests.map((x) => x.id);
  move(order, a.id, a.direction);
  g.guests = order.map((i) => find(g.guests, i));
});
register('guest.order', invKeys, (s, a) => {
  const g = getGroup(s, a.group_id);
  g.guests = reorder(
    g.guests.map((x) => x.id),
    a.ids,
  ).map((i) => find(g.guests, i));
});
register('prices.set', ['ds_prices'], (s, a) => {
  const v = object(a.values);
  for (const k of Object.keys(v))
    if (!['adulto', 'bambino', 'neonato', 'adultoMenu'].includes(k)) fail('Prezzo non ammesso');
  for (const k of ['adulto', 'bambino', 'neonato']) if (k in v) s.ds_prices[k] = number(v[k]);
  if (v.adultoMenu) {
    object(v.adultoMenu);
    for (const [k, n] of Object.entries(v.adultoMenu)) {
      enumeration(k, ['carne', 'pesce', 'vegetariano', 'vegano']);
      s.ds_prices.adultoMenu[k] = number(n);
    }
  }
});
const entities = {
  budget: [
    'ds_budget',
    'voci',
    {
      descrizione: '',
      categoria: 'Ricevimento',
      preventivo: 0,
      pagato: 0,
      stato: 'da_pagare',
      note: '',
    },
    'descrizione',
  ],
  supplier: [
    'ds_fornitori',
    'fornitori',
    {
      nome: '',
      azienda: '',
      categoria: 'Altro',
      telefono: '',
      email: '',
      sito: '',
      preventivo: 0,
      importo: 0,
      stato: 'dacontattare',
      note: '',
    },
    'nome',
  ],
  event: [
    'ds_programma',
    'eventi',
    { titolo: '', ora: '', categoria: 'Altro', luogo: '', durata: 0, note: '' },
    'titolo',
    'eventOrder',
  ],
  task: [
    'ds_checklist',
    'items',
    {
      titolo: '',
      fase: '',
      categoria: 'Altro',
      priorita: 'media',
      stato: 'todo',
      scadenza: '',
      note: '',
    },
    'titolo',
  ],
  table: [
    'ds_tavoli',
    'tavoli',
    { posti: 10, shape: 'round', rotation: 0, x: 220, y: 190, guestIds: [] },
    null,
    'tableOrder',
  ],
};
for (const [kind, [key, field, defaults, required, order]] of Object.entries(entities)) {
  const keys = kind === 'table' ? ['ds_tavoli', 'ds_invitati'] : [key];
  register(kind + '.save', keys, (s, a) => {
    const d = s[key],
      values = patch(kind, object(a.values));
    let item;
    if (a.id) {
      item = find(d[field], a.id);
      Object.assign(item, values);
    } else {
      item = { ...structuredClone(defaults), ...values, id: uuid() };
      d[field].push(item);
      if (order) d[order].push(item.id);
    }
    if (required) text(item[required], true);
    if (kind === 'event') patch(kind, { ora: item.ora });
    if (kind === 'table') {
      if (item.shape === 'round') item.rotation = 0;
      validateTables(s);
    }
    return { id: item.id };
  });
  register(kind + '.delete', keys, (s, a) => {
    const d = s[key];
    find(d[field], a.id);
    d[field] = d[field].filter((x) => x.id !== a.id);
    if (order) d[order] = d[order].filter((x) => x !== a.id);
  });
}
register('budget.total', ['ds_budget'], (s, a) => {
  s.ds_budget.totale = number(a.value);
});
register('budget.catering', ['ds_budget', 'ds_prices', 'ds_invitati'], (s) => {
  const cost = cateringCost(s);
  if (!cost) fail('Imposta prima i prezzi del menù');
  let item = s.ds_budget.voci.find((v) => v._catering);
  if (!item) {
    item = {
      id: uuid(),
      descrizione: 'Catering / Banchetto',
      categoria: 'Ricevimento',
      pagato: 0,
      stato: 'da_pagare',
      note: 'Importato da sezione Invitati',
      _catering: true,
    };
    s.ds_budget.voci.push(item);
  }
  item.preventivo = cost;
});
register('event.date', ['ds_programma'], (s, a) => {
  s.ds_programma.data = date(a.value);
});
register('event.sort', ['ds_programma'], (s) => {
  s.ds_programma.eventOrder = [...s.ds_programma.eventi]
    .sort((a, b) => a.ora.localeCompare(b.ora))
    .map((e) => e.id);
});
register('event.move', ['ds_programma'], (s, a) =>
  move(s.ds_programma.eventOrder, a.id, a.direction),
);
register('event.order', ['ds_programma'], (s, a) => {
  s.ds_programma.eventOrder = reorder(s.ds_programma.eventOrder, a.ids);
});
register('task.cycle', ['ds_checklist'], (s, a) => {
  const item = find(s.ds_checklist.items, a.id);
  item.stato = { todo: 'wip', wip: 'done', done: 'todo' }[item.stato] || 'todo';
});
register('task.template', ['ds_checklist'], (s) => {
  const existing = new Set(s.ds_checklist.items.map((x) => x.titolo));
  let added = 0;
  for (const item of DEFAULTS)
    if (!existing.has(item.titolo)) {
      s.ds_checklist.items.push({ ...item, id: uuid(), scadenza: '', note: '' });
      existing.add(item.titolo);
      added++;
    }
  return { added };
});
register('table.assign', ['ds_tavoli', 'ds_invitati'], (s, a) => {
  const guest = find(guests(s), a.guest_id);
  if (guest.formale || guest.status !== 'confermato')
    fail('Solo gli invitati confermati possono essere assegnati');
  const t = find(s.ds_tavoli.tavoli, a.id);
  s.ds_tavoli.tavoli.forEach((x) => {
    x.guestIds = x.guestIds.filter((g) => g !== guest.id);
  });
  t.guestIds.push(guest.id);
  validateTables(s);
});
register('table.unassign', ['ds_tavoli'], (s, a) => {
  const t = find(s.ds_tavoli.tavoli, a.id);
  id(a.guest_id);
  t.guestIds = t.guestIds.filter((x) => x !== a.guest_id);
});
register('table.layout', ['ds_tavoli'], (s, a) => {
  Object.assign(s.ds_tavoli.layout, patch('layout', a.values));
});
