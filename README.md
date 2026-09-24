# Day Special

Web-app per organizzare un matrimonio in due: invitati, budget, fornitori,
programma della giornata, tavoli e checklist, sempre sincronizzati tra i
dispositivi e utilizzabili anche offline.

## Caratteristiche

- **Sei sezioni operative**: invitati (gruppi, conferme, intolleranze), budget
  con preventivi e pagamenti, fornitori, programma della giornata, sala grafica
  con tavoli trascinabili e assegnazione degli invitati, checklist dei preparativi.
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

- Node.js **≥ 22.12.0** (per il modulo nativo `node:sqlite`).
  Su Node 22.12 SQLite richiede `--experimental-sqlite`: i comandi npm di avvio
  e verifica lo includono già; aggiungerlo anche avviando direttamente `server.js`.

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
scarica il pacchetto, fa il backup dei file sostituiti e si riavvia. Se la
scrittura di un file fallisce a metà, i file già sostituiti vengono rimessi
dal backup e l'aggiornamento è annullato.

Il riavvio è delegato a un supervisore esterno: dopo l'installazione il server
esce con codice **42** e deve essere rilanciato (con systemd, per esempio,
`Restart=always` oppure `RestartForceExitStatus=42`). Senza supervisore il
server resta spento dopo un aggiornamento.

- La variabile d'ambiente `DS_UPDATE_URL` permette di puntare a un manifest
  diverso; se definita ma vuota, gli aggiornamenti sono disattivati.
- Le release si costruiscono con `node scripts/build-update.mjs`, che produce
  `dist/manifest.json` e il pacchetto `dist/day-special-<versione>.json.gz` e
  suggerisce il comando `gh release create` da eseguire.
- In alternativa, il workflow GitHub Actions `.github/workflows/release.yml`
  pubblica la release da solo: al push di un tag `vX.Y.Z`, oppure avviato a mano
  da Actions (`workflow_dispatch`, solo su `main`) indicando la versione, nel qual
  caso crea lui il tag al termine. Verifica che la versione corrisponda a
  `package.json`, che non esistano già il tag o una release (anche in bozza) e che
  `public/index.html` sia allineato ai sorgenti, poi costruisce il pacchetto e
  carica gli asset. La nota mostrata
  nell'app viene dal messaggio del tag annotato (`git tag -a vX.Y.Z -m "nota"`) o
  dall'input `note`; in mancanza, dal soggetto del commit `Release X.Y.Z: ...`.

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
Le scritture richiedono la revisione attesa: controllo e aggiornamento avvengono
nella stessa transazione SQLite. In caso di concorrenza il client riconcilia
automaticamente il documento e riprova. Per ogni documento invia una sola
scrittura alla volta, preceduta da una lettura aggiornata anche nei retry.
Gli eventi con revisioni superate vengono ignorati; l'apertura dello stream,
compresa la prima, recupera lo stato completo.

Dopo questo aggiornamento, le pagine già aperte con il vecchio client devono
essere ricaricate: le loro scritture senza revisione vengono rifiutate con 428,
preservando le modifiche presenti nel browser.

I backup usano `VACUUM INTO` per includere le scritture nel WAL anche con lettori
attivi. Lo snapshot viene verificato con `integrity_check` e pubblicato solo
se integro. Un errore di backup viene registrato senza invalidare una scrittura
già confermata; i backup restano soggetti alla ritenzione di 20 copie.

### API

- `GET /api/health` — stato e conteggi
- `GET /api/data` — tutti i documenti (bootstrap del client)
- `GET /api/documents/:key` — documento e revisione correnti, oppure 404
- `PUT /api/documents/:key` — scrittura condizionata (body `{ value, expected_rev }`, massimo
  2 MB; l'header opzionale `X-DS-Client` identifica l'istanza che scrive)
  La revisione attesa è 0 per una nuova chiave. Successo: `{ updated_at, rev }`;
  conflitto: HTTP 409 con `{ error, current }`, senza scrittura né evento SSE.
  Revisione assente o non valida: HTTP 428.
- `GET /api/stream` — Server-Sent Events: un evento `change` per ogni PUT riuscita,
  inviato a tutti i client compreso chi ha scritto (`origin` = `X-DS-Client`,
  così il mittente riconosce e ignora l'eco); heartbeat ogni 25 s
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

Smoke test del server con database in memoria (non tocca `data/` e non
controlla gli aggiornamenti): avvia `server.js` come processo figlio,
interroga `/api/health` e `/api/data` e lo chiude da solo.

```sh
npm run smoke
```

L'app non ha autenticazione applicativa: è pensata per girare in una rete
privata o dietro un proxy che si occupi dell'accesso.

Verifiche di regressione con il test runner integrato di Node:

```sh
npm test
```

I test coprono retry, conflitti e richieste sovrapposte con rete simulata,
recupero SSE, API HTTP e backup con lettori SQLite attivi. Usano esclusivamente
database in memoria e copie temporanee dell'applicazione.

## Licenza

[MIT](LICENSE)
