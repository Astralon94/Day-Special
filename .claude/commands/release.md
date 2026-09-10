---
description: Prepara una release di Day Special (bump versione, build, pacchetto di aggiornamento) e si ferma prima della pubblicazione
allowed-tools: Bash(npm run build:*), Bash(node scripts/build-update.mjs:*), Bash(node --check:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(gh release list:*)
---

Prepara la release di Day Special. Versione richiesta e nota: $ARGUMENTS

Procedura, da seguire nell'ordine:

1. Verifica che l'albero di lavoro sia pulito (`git status`) e che `node --version` sia >= 22.12.
2. Aggiorna `version` in `package.json` e `package-lock.json` (campo `version` in entrambi, senza `npm version`).
   Se non è stata indicata una versione, proponi la patch successiva e chiedi conferma.
3. Esegui `npm run build` così che `public/index.html` corrisponda ai sorgenti.
4. Esegui `node scripts/build-update.mjs --note "<nota>"` e riporta il numero di file e la dimensione del pacchetto.
   Se lo script avvisa che `public/index.html` è più vecchio di `src/`, ripeti il build.
5. Se la release cambia quanto descritto nel `README.md`, aggiornalo nello stesso commit.
6. Committa con messaggio `Release <versione>: <descrizione>` e mostra il comando `gh release create`
   stampato dallo script.

**Fermati qui.** Non eseguire `gh release create`, non fare push e non creare tag senza richiesta esplicita:
la produzione si aggiorna da sola non appena vede la release pubblicata.
