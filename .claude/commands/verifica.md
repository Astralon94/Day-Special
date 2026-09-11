---
description: Build del frontend, controllo sintassi dei file modificati e smoke test del server
allowed-tools: Bash(npm run build:*), Bash(npm run smoke:*), Bash(node --check:*), Bash(node scripts/smoke.mjs:*), Bash(git diff:*), Bash(git status:*)
---

Esegui la verifica completa del progetto Day Special, nell'ordine, e riporta l'esito di ogni passo.

1. Controllo sintassi: per ogni file `.js`/`.mjs` modificato (`git diff --name-only HEAD` più i file non tracciati)
   esegui `node --check <file>` **una invocazione per file**. Fermati e segnala se uno fallisce.
2. Build: se sono cambiati `index.html`, `src/` o `vite.config.js`, esegui `npm run build` e conferma che
   `public/index.html` sia stato rigenerato (deve comparire in `git status`). Non modificare il bundle a mano.
3. Smoke test del server senza toccare il DB su disco:
   ```sh
   npm run smoke
   ```
   Esegue `scripts/smoke.mjs`: avvia `server.js` come processo figlio con `DS_DB=:memory:` sulla porta 4435,
   interroga `/api/health` e `/api/data`, poi lo chiude da solo. Non usare `&`, `sleep` e `kill` nella shell:
   in modalità auto vengono bloccati. Esito atteso: entrambe le righe `OK … → 200`, `/api/health` con
   `{"ok":true,...}`. Se fallisce lo script stampa da solo il log del server: riportalo.
4. Ricorda nel riepilogo cosa resta da verificare a mano nel browser (navigazione hash, tema, sync tra due profili).

Argomenti opzionali: $ARGUMENTS
