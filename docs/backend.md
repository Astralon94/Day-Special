# Backend autorevole

SQLite è l'unica fonte dei dati confermati. Le tabelle `documents` e `meta`
esistenti rimangono; `command_receipts` viene aggiunta senza trasformare o
cancellare documenti. La struttura JSON resta un dettaglio di persistenza:
il server interpreta gli aggregati e ne controlla le regole.

## Lettura e scrittura

`GET /api/state` restituisce `protocol: 2`, `documents` (valore, revisione e data
per ciascuna sezione) e `computed` (proiezioni calcolate, incluso il catering).
La lettura avviene in una transazione SQLite consistente. I default di sezioni
mai salvate sono deterministici e non producono scritture durante una GET.

`POST /api/commands` riceve:

```json
{
  "id": "identificativo-univoco-della-richiesta",
  "operation": "budget.total",
  "input": { "value": 15000 },
  "expected": { "ds_budget": 3 }
}
```

Ogni operazione dichiara gli aggregati necessari. In una sola transazione
`BEGIN IMMEDIATE`, il servizio controlla le revisioni, esegue l'operazione,
scrive i soli aggregati cambiati e conserva una ricevuta. Il risultato contiene
`result`, `changed`, `state` e `replayed`.

- Un identificativo già completato con lo stesso contenuto restituisce la
  ricevuta e lo stato corrente senza ripetere l'operazione, anche dopo un riavvio.
- Il riuso dello stesso identificativo con contenuto differente è rifiutato.
- Revisioni obsolete: 409, nessuna modifica. Il client aggiorna i dati e
  avvisa; i moduli mantengono la revisione di apertura e vanno riaperti per
  lavorare sulla nuova versione. I campi diretti di Budget, Invitati, Programma e capienza tavoli conservano
  la revisione di inizio modifica: il render remoto attende la fine della
  modifica e i campi invariati non generano comandi. Nessun merge o invio forzato.
- Campi non ammessi, date, numeri o stati invalidi: 422. Revisione mancante: 428.
- L'endpoint storico `PUT /api/documents/:key` risponde 410: nessuna pagina
  precedente può aggirare i controlli inviando interi documenti.

## Operazioni

| Area | Operazioni |
|---|---|
| Gruppi | `group.create`, `group.patch`, `group.delete`, `group.move`, `group.order`, `group.contact` |
| Invitati | `guest.create`, `guest.patch`, `guest.delete`, `guest.transfer`, `guest.move`, `guest.order` |
| Prezzi | `prices.set` |
| Budget | `budget.save`, `budget.delete`, `budget.total`, `budget.catering` |
| Fornitori | `supplier.save`, `supplier.delete` |
| Programma | `event.save`, `event.delete`, `event.date`, `event.sort`, `event.move`, `event.order` |
| Checklist | `task.save`, `task.delete`, `task.cycle`, `task.template` |
| Sala | `table.save`, `table.delete`, `table.assign`, `table.unassign`, `table.layout` |

Gli identificativi delle nuove entità sono generati dal server. Le operazioni
`*.save` ricevono `values` con i campi ammessi e, solo per modificare, `id`.
Gli ordini devono essere permutazioni esatte degli identificativi correnti.

L'assegnazione a un tavolo controlla esistenza, conferma, unicità e capienza
nella stessa transazione. La cancellazione di invitati/gruppi rimuove anche i
riferimenti ai tavoli; trasferimenti e referenti familiari sono atomici.
La conferma rimuove lo stato formale; marcare formale un confermato è rifiutato.
L'importazione catering usa i prezzi e gli invitati letti sul server, non un
importo calcolato dal browser. Le mutazioni che coinvolgono più sezioni
controllano tutte le rispettive revisioni.

## Browser e rete

Il browser contiene una copia in memoria e una cache opzionale di soli
snapshot confermati (`ds_server_cache_v2`). Non contiene merge, coda offline
persistente, generazione di entità o regole di assegnazione. Calcoli grafici,
filtri, ordinamenti di visualizzazione e riepiloghi di sola lettura restano
nelle viste; nessuno di essi autorizza una scrittura.

La UI attende il commit prima di mostrare il risultato come salvato. Durante
una richiesta, incluse le letture finali prima del ritorno alla vista, e senza connessione, nuove modifiche sono bloccate. Le fetch
hanno timeout; se l'esito di un comando è incerto, la pagina conserva in memoria
la richiesta già emessa e la ripete con lo stesso ID finché riceve conferma.
Non è una coda per lavorare offline. La chiusura della pagina in questo stato
mostra l'avviso del browser; alla riapertura viene riletto SQLite.

SSE invia esclusivamente `invalidate {keys}` dopo un commit; il client rilegge
lo stato completo, anche alla prima connessione e alle riconnessioni. Un
controllo periodico ogni 15 secondi recupera notifiche perse e verifica la
raggiungibilità. Una risposta GET iniziata prima di un comando non può
sostituire lo snapshot restituito dal commit.

Senza server, una pagina già caricata permette consultazione e navigazione
sui dati confermati in cache. Non è una PWA: aprire l'app da zero richiede che
il browser disponga anche degli asset, oppure che il server sia raggiungibile.
Una cache non scrivibile non impedisce i salvataggi sul database.

## Passaggio dalla versione precedente

1. Prima dell'installazione, chiudere i salvataggi della vecchia versione con
   server raggiungibile e verificare i backup.
2. I documenti SQLite non vengono sostituiti dai browser. Default e vecchi
   campi compatibili sono interpretati dal backend senza riscritture in lettura.
3. Le vecchie chiavi locali, incluse `ds_base` e `ds_rev`, rimangono intatte.
   In Impostazioni si può esportare la copia precedente per recuperare eventuali
   modifiche non inviate. Non esiste importazione automatica o distruttiva.
4. Le pagine precedenti vanno ricaricate. Eventuali dati legacy malformati o
   assegnazioni già incoerenti richiedono verifica: il backend non li cancella
   silenziosamente per far passare i controlli. I campi mancanti compatibili
   ricevono default in lettura; i documenti non interpretabili sono segnalati
   con `error` e `value: null`. Solo le operazioni che li usano sono bloccate,
   mentre le altre sezioni rimangono operative.

## Persistenza e aggiornamenti

SQLite usa WAL, `synchronous=FULL` e attesa limitata dei lock. I backup
`VACUUM INTO` includono il WAL, vengono verificati e pubblicati con rename.
Il backup contiene anche le ricevute dei comandi; conservare DB e ricevute
insieme è necessario per la deduplicazione dopo un ripristino.

L'installazione software è esclusiva, richiede un backup riuscito su disco e
sospende nuovi comandi fino al riavvio. Un download troncato fallisce senza
lasciare la promessa in attesa; download e decompressione hanno limiti di memoria.

La protezione degli accessi resta a monte, come nella versione precedente.
Il backend non aggiunge un nuovo sistema di login.
