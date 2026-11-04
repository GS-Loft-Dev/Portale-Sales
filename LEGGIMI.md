# Performance Sales GS LOFT su Netlify

Dashboard delle performance dei sales con i dati letti da HubSpot ogni 3 ore.

## Come funziona

- `netlify/functions/refresh.mjs` gira ogni 3 ore (00, 03, 06, … UTC). Legge da HubSpot le riunioni e le trattative pagate di ogni sales, le somma per giorno e salva il risultato su Netlify Blobs. Non salva nomi o dati dei clienti, solo i conteggi.
- `netlify/functions/data.mjs` consegna quei dati alla pagina su `/api/data`.
- `public/index.html` è il dashboard, con le viste mensile, settimanale, confronto tra sales e vendite per tipologia, più i filtri per sales e periodo.
- `netlify/edge-functions/auth.js` chiede una password se imposti `DASHBOARD_PASSWORD`.

Come si leggono i dati in HubSpot:

| Dashboard | HubSpot |
|---|---|
| Appuntamenti | Riunioni assegnate al sales (data dell'attività) |
| Risposto / Non risposto / Annullate | Esito riunione Completed / No show / Canceled |
| Senza esito | Riunioni rimaste Scheduled o Rescheduled |
| Pagati | Trattative con "Data primo pagamento" |
| Tipologia | Campo "Pacchetto" della trattativa |

## Pubblicazione, una volta sola

### 1. Token HubSpot

In HubSpot apri Impostazioni > Integrazioni > App private (o "Legacy apps") e crea un'app chiamata "Dashboard Performance Sales".

Ambiti di sola lettura:

- `crm.objects.deals.read`
- `crm.objects.contacts.read`, necessario per leggere le riunioni

Copia il token di accesso.

### 2. Sito su Netlify

Le funzioni programmate non partono se trascini la cartella su Netlify Drop. Usa uno di questi due modi:

- **Da GitHub (consigliato):** carica questa cartella in un repository, per esempio `GS-Loft-Dev/performance-sales`. In Netlify scegli Add new site > Import an existing project e seleziona il repository. Le impostazioni di build arrivano da `netlify.toml`.
- **Da terminale:** dentro questa cartella esegui `npm install`, poi `npx netlify-cli login` e `npx netlify-cli deploy --prod`.

### 3. Variabili d'ambiente

In Netlify > Site configuration > Environment variables imposta:

- `HUBSPOT_TOKEN`: il token del punto 1.
- `DASHBOARD_PASSWORD`, consigliata: la password per aprire il dashboard. Il nome utente può essere qualsiasi. Senza questa variabile il sito è pubblico.

Poi fai un nuovo deploy: Deploys > Trigger deploy.

### 4. Primo aggiornamento

In Netlify > Logs > Functions > `refresh` premi **Run now**. Dopo pochi secondi il dashboard mostra i dati. Da quel momento si aggiorna da solo ogni 3 ore.

## Modifiche frequenti

- **Aggiungere o togliere un sales:** modifica la lista `SALES` in `netlify/lib/config.mjs`. L'ID proprietario si trova in HubSpot, oppure chiedilo a Claude.
- **Cambiare i prezzi di listino:** modifica `LISTINO` nello stesso file.
- **Cambiare la frequenza:** modifica `schedule` in fondo a `netlify/functions/refresh.mjs`. Per esempio `"0 */1 * * *"` aggiorna ogni ora.

Se un aggiornamento da HubSpot fallisce, il dashboard continua a mostrare gli ultimi dati validi con un avviso in alto. Il dettaglio dell'errore è nei log della funzione `refresh`.
