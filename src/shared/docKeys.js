// Unica fonte di verità per le chiavi documento dell'app (client + server).
// Una chiave mancante qui = esclusa da export/import/sync (perdita dati silenziosa,
// già capitato in passato quando client e server avevano copie separate della lista).
export const DOC_KEYS = [
  'ds_invitati',
  'ds_prices',
  'ds_budget',
  'ds_fornitori',
  'ds_programma',
  'ds_tavoli',
  'ds_checklist',
];
