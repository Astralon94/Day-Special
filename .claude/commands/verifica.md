---
description: Build del frontend, controllo sintassi dei file modificati e smoke test del server
allowed-tools: Bash(npm run build:*), Bash(node --check:*), Bash(git diff:*), Bash(git status:*), Bash(DS_DB=:memory: DS_UPDATE_URL= PORT=4435 node server.js:*), Bash(curl --fail http://localhost:4435/:*), Bash(kill:*)
---

Esegui la verifica completa del progetto Day Special, nell'ordine, e riporta l'esito di ogni passo.

1. Controllo sintassi: per ogni file `.js`/`.mjs` modificato (`git diff --name-only HEAD` più i file non tracciati)
   esegui `node --check <file>` **una invocazione per file**. Fermati e segnala se uno fallisce.
2. Build: se sono cambiati `index.html`, `src/` o `vite.config.js`, esegui `npm run build` e conferma che
   `public/index.html` sia stato rigenerato (deve comparire in `git status`). Non modificare il bundle a mano.
3. Smoke test del server senza toccare il DB su disco:
   ```sh
   DS_DB=:memory: DS_UPDATE_URL= PORT=4435 node server.js > /tmp/ds-smoke.log 2>&1 &
   sleep 1
   curl --fail http://localhost:4435/api/health
   curl --fail http://localhost:4435/api/data
   kill %1
   ```
   `/api/health` deve rispondere `{"ok":true,...}`. Riporta il contenuto di `/tmp/ds-smoke.log` se qualcosa fallisce.
4. Ricorda nel riepilogo cosa resta da verificare a mano nel browser (navigazione hash, tema, sync tra due profili).

Argomenti opzionali: $ARGUMENTS
