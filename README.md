# Day Special

Web-app per organizzare un matrimonio in due: invitati, budget, fornitori,
programma della giornata, tavoli e checklist, sempre sincronizzati tra i
dispositivi e utilizzabili anche offline.

## Caratteristiche

- **Sei sezioni operative**: invitati (gruppi, conferme, intolleranze), budget
  con preventivi e pagamenti, fornitori, programma della giornata, disposizione
  dei tavoli, checklist dei preparativi.
- **Offline-first**: i dati vivono nel browser (localStorage) e la UI non
  aspetta mai la rete; il server è un mirror sincronizzato in background.
- **Sync in tempo reale**: le modifiche si propagano agli altri dispositivi via
  Server-Sent Events; le modifiche concorrenti si fondono automaticamente con
  un merge a 3 vie, senza popup di conflitto.
- **Zero dipendenze runtime**: il server è Node puro (`node:http` +
  `node:sqlite`), il frontend è un singolo `index.html` autosufficiente.
  L'unica dipendenza di sviluppo è Vite, usata solo per il build.
- **Backup automatici** del database lato server e prima di ogni aggiornamento.
- **Aggiornamenti in-app**: l'app controlla le release di questa repo e si
  aggiorna da sola, con backup e riavvio automatici.
- Tema chiaro/scuro, export CSV delle liste.

## Requisiti

- Node.js **≥ 22.5** (per il modulo nativo `node:sqlite`).

## Avvio rapido

```sh
npm start          # avvia il server sulla porta 4335 (override con PORT=...)
```

Il frontend già buildato è versionato in `public/index.html`: per usare l'app
basta il server, senza alcun `npm install`. Apri `http://localhost:4335`.

I dati finiscono in `data/day-special.db` (SQLite, con backup in
`data/backups/`): la cartella è creata al primo avvio e non è mai toccata
dagli aggiornamenti.

## Aggiornamenti

L'app si aggiorna da sola: dalla sezione **Impostazioni** controlla il
`manifest.json` pubblicato nelle [release di questa repo](../../releases),
scarica il pacchetto, fa il backup dei file sostituiti e si riavvia.

- La variabile d'ambiente `DS_UPDATE_URL` permette di puntare a un manifest
  diverso; se definita ma vuota, gli aggiornamenti sono disattivati.
- Le release si costruiscono con `node scripts/build-update.mjs`, che produce
  `dist/manifest.json` e il pacchetto `dist/day-special-<versione>.json.gz` e
  suggerisce il comando `gh release create` da eseguire.

## Architettura

| Percorso | Ruolo |
|----------|-------|
| `server.js` | Server HTTP: statico da `public/` + API `/api/*` |
| `server/db.js` | Connessione `node:sqlite` (WAL), DDL, backup automatici |
| `server/documents.js` | Accesso alla tabella `documents` (key-value) |
| `server/updater.js` | Aggiornamento software via manifest + pacchetto su GitHub Releases |
| `src/` | Sorgenti della SPA (router a hash, una vista per sezione) |
| `src/shared/docKeys.js` | Elenco delle chiavi documento, condiviso tra client e server |
| `src/state/` | Layer dati: localStorage, merge a 3 vie, sync via fetch + SSE |
| `public/` | Asset statici + `index.html` buildato (l'app runnable) |

Il modello dati è una singola tabella key-value documentale: ogni sezione
dell'app è un documento JSON opaco per il server, con una revisione (`rev`)
incrementata dal server a ogni scrittura e usata dal client per il merge.

### API

- `GET /api/health` — stato e conteggi
- `GET /api/data` — tutti i documenti (bootstrap del client)
- `PUT /api/documents/:key` — upsert di un documento
- `GET /api/stream` — Server-Sent Events con le modifiche degli altri dispositivi
- `GET/POST /api/updates*` — controllo e installazione aggiornamenti

## Sviluppo

```sh
npm install        # solo devDependencies (Vite)
npm run dev        # dev server Vite per iterare sul frontend
npm run build      # build singlefile → public/index.html
```

Per provare la build reale servita dal server Node:

```sh
npm run build && PORT=4435 node server.js
```

L'app non ha autenticazione applicativa: è pensata per girare in una rete
privata o dietro un proxy che si occupi dell'accesso.

## Licenza

[MIT](LICENSE)
