# Day Special

Planner di matrimonio per due, offline-first: SPA singlefile (Vite) + server Node puro
(`node:http` + `node:sqlite`), zero dipendenze runtime, sync multi-dispositivo via SSE.
Architettura e API complete sono nel `README.md`: questo file contiene solo ciò che serve
per lavorare in autonomia senza rompere i contratti del progetto.

Lingua del progetto: **italiano** (commenti, commit, UI, documentazione).

## Setup dell'ambiente (locale o cloud)

- Node **>= 22.12.0** (`package.json`): `node:sqlite` non esiste su versioni precedenti.
  Verifica con `node --version` prima di qualsiasi altra cosa; se la versione è più bassa
  segnalalo e non provare a far girare il server.
- `npm ci` installa solo le devDependencies (Vite + `vite-plugin-singlefile`).
  Serve solo per `npm run build` e `npm run dev`; il server gira senza `node_modules`.
- `.nvmrc` indica Node 22 per gli strumenti che lo rispettano; l'hook `SessionStart`
  (`.claude/hooks/setup.sh`) avvisa se la versione è insufficiente e installa le devDependencies:
  `npm install` a ogni sessione remota (`CLAUDE_CODE_REMOTE=true`), `npm ci` in locale solo se
  manca `node_modules`. Se vedi un avviso `[setup]` all'avvio, leggilo prima di agire.
- In un ambiente cloud non esistono: la produzione (`~/Day-Special`), i launcher
  `avvia-dev.sh`/`ferma-dev.sh`, la cartella `data/` con il DB reale, `AGENTS.md`.
  Sono tutti file locali ignorati da Git: non ricrearli e non aspettarti che ci siano.
- In cloud `gh` non c'è e il push dei tag è rifiutato (403): puoi preparare una release
  (bump, build, pacchetto, commit, PR) e, su richiesta esplicita, pubblicarla avviando
  `.github/workflows/release.yml` con `workflow_dispatch` sul commit di release in `main`
  (strumento GitHub `actions_run_trigger`, input `version` e `note`). Dal Mac valgono anche
  `gh release create` e il push di un tag `vX.Y.Z`.

## Comandi di sviluppo e verifica

- `npm run dev` avvia solo Vite: nessun backend né proxy `/api`. Per verificare la sync
  usa la build servita da Node sullo stesso origin.
- `npm run build` genera `dist/index.html` e lo copia in **`public/index.html`, versionato**.
  Modifica i sorgenti (`index.html`, `src/`), mai il bundle; dopo ogni modifica frontend
  rigenera il bundle e committalo insieme ai sorgenti.
- Avvio della build reale: `PORT=4435 node server.js` dopo il build.
  Mai la porta 4335 (default di `npm start`, riservata alla produzione locale).
- Smoke test senza toccare il DB su disco né controllare release:
  ```sh
  DS_DB=:memory: DS_UPDATE_URL= PORT=4435 node server.js &
  curl --fail http://localhost:4435/api/health
  kill %1
  ```
  I dati in memoria spariscono allo stop.
- Non esistono suite di test, lint o typecheck. Controllo sintassi per ogni file
  JS/MJS modificato: `node --check <file>`, **un file per invocazione**
  (`node --check` con più percorsi non li controlla tutti).
- Verifica manuale del frontend: build, console senza errori, navigazione hash e tema,
  modifica/ricarica, modifica offline/riconnessione, sync e modifiche concorrenti.
  Per provare davvero SSE servono due profili browser: due tab condividono gli eventi `storage`.
- Il comando `/verifica` esegue build + controllo sintassi + smoke test in sequenza.

## Contratti da preservare

- `src/main.js` monta il router **prima** di `Sync.init()`: la UI non aspetta la rete.
  localStorage è la fonte primaria della UI; HTTP + SSE sincronizzano il mirror SQLite.
  Nessun Supabase/Netlify nel flusso attuale.
- I documenti sono blob JSON opachi per il server. Nuova chiave `ds_*`: aggiungila solo a
  **`src/shared/docKeys.js` (`DOC_KEYS`)**, condiviso da client e server. Una chiave assente
  lì è esclusa dalla sync (perdita dati silenziosa, già successo in passato).
- Nelle viste leggi/scrivi i documenti via `DS.get` / `DS.set`, mai localStorage diretto.
  `DS.set` emette `ds:change {key, remote:false}` e accoda il push;
  `remote:true` indica applicazione remota o evento cross-tab e non deve riaccodare il push.
- Conflitti: merge automatico a 3 vie in `src/state/storage.js`, riconciliazione in
  `src/state/sync.js`; niente popup Ricarica/Forza. `rev` viene incrementata solo dal server,
  non dall'orologio client; il PUT non fa compare-and-swap e non restituisce 409.
  `PUT /api/documents/:key` riceve `{ value }` e restituisce `{ updated_at, rev }`.
- Gli array di entità si fondono per `id` stabile; le cancellazioni dalla base prevalgono
  sulle modifiche concorrenti. Gli array scalari (es. `guestIds`) non si uniscono come insiemi.
- Non cancellare `ds_base` o `ds_rev`: senza base il merge sceglie un documento intero.
  Mai azzerare localStorage o troncare `documents` senza backup verificato e conferma esplicita.
- La spia di salvataggio è gestita da `Sync` e riflette lo stato confermato dal server:
  non aggiungere un "salvato" ottimistico dalle viste al completamento della scrittura locale.
- Viste (`src/ui/views/*.js`): esportano `html`, `title` opzionale, `mount(root)` che può
  restituire una funzione di cleanup. Il router la esegue prima di sostituire il DOM:
  rimuovi lì i listener della vista.
- Moduli ES con API IIFE; `App`, `DS`, `Sync` e gli handler delle viste sono anche su
  `window` per gli attributi `onclick` nel markup. Preserva questi collegamenti nei refactor.
- Input utente nel markup sempre tramite `App.esc()`.

## Dati, produzione e release

- `server/db.js` apre il DB già all'import. Default: `data/day-special.db` (WAL);
  `DS_DB` cambia il percorso, i backup restano in `data/backups/`.
  Non usare un DB reale per prove distruttive o script di migrazione.
- Nessuna autenticazione applicativa, incluse le API di aggiornamento:
  l'accesso va protetto a monte (in produzione Cloudflare Access). Non aggiungere login.
- La produzione è un'installazione separata gestita da un servizio systemd e aggiornata
  solo tramite updater in-app + GitHub Releases su `Astralon94/Day-Special`.
  Non toccarla mai a mano e non tentare di raggiungerla dall'ambiente cloud.
- L'updater termina con exit **42**: serve un supervisore che riavvii il processo.
- Pacchetto release: prima `npm run build`, poi `node scripts/build-update.mjs --note "testo"`.
  La versione viene da `package.json`; produce `dist/manifest.json` e
  `dist/day-special-<versione>.json.gz`. Il packager esclude `data/`, `scripts/`, `dist/`,
  `CLAUDE.md`, `AGENTS.md`, i launcher e tutto ciò che inizia con `.` (quindi `.claude/`).
- **Non pubblicare release** (`gh release create`, push di un tag `v*` o avvio del workflow)
  e non fare bump di versione senza richiesta esplicita: la produzione si aggiorna da sola
  quando vede una release nuova. Il comando `/release` descrive la procedura completa.
- Il workflow `.github/workflows/release.yml` si avvia al push di un tag `vX.Y.Z` o a mano
  (`workflow_dispatch`, che crea il tag da solo): fallisce se la versione non corrisponde a
  `package.json`, se il tag esiste già o se `public/index.html` non è allineato a `src/`.
  Va avviato sul commit di release già in `main`.
- Se una modifica cambia quanto descritto nel README, aggiornalo nello stesso commit,
  mantenendo uno stile pubblico senza domini o dettagli del setup personale.

## Git e convenzioni di commit

- Messaggi di commit in italiano, all'indicativo, una riga di soggetto
  (es. `Corregge il merge dei tavoli senza id`). Le release usano `Release x.y.z: descrizione`.
- Non committare mai: `data/`, `dist/`, `node_modules/`, `AGENTS.md`, file `.env*`,
  `.claude/settings.local.json`. Committa invece `public/index.html` quando cambia il frontend.
- In ambiente cloud lavora su un branch e apri una PR verso `main`, salvo istruzione diversa.
  Mai `git push --force` su `main`.
- `AGENTS.md` è una copia di lavoro locale, intenzionalmente ignorata da Git:
  questo `CLAUDE.md` è la versione versionata di riferimento. Se aggiorni uno, allinea l'altro.
