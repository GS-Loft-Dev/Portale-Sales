// Funzione programmata: ogni 3 ore legge HubSpot e salva i dati del dashboard.
// In Netlify > Functions > refresh si può anche premere "Run now" per aggiornare subito.
import { getStore } from "@netlify/blobs";
import { buildData } from "../lib/hubspot.mjs";
import { STORE_NAME, DATA_KEY } from "../lib/config.mjs";

export default async () => {
  const token = Netlify.env.get("HUBSPOT_TOKEN");
  if (!token) {
    console.error("Manca la variabile d'ambiente HUBSPOT_TOKEN");
    return new Response("HUBSPOT_TOKEN mancante", { status: 500 });
  }
  const store = getStore(STORE_NAME);
  try {
    const data = await buildData(token);
    await store.setJSON(DATA_KEY, data);
    console.log(`Aggiornato: ${data.counts.meetings} appuntamenti, ${data.counts.paidDeals} pagamenti`);
    return new Response("ok");
  } catch (err) {
    console.error(err);
    // Registra l'errore senza cancellare gli ultimi dati validi.
    await store.setJSON("last-error.json", { at: new Date().toISOString(), message: String(err.message || err) });
    return new Response("errore", { status: 500 });
  }
};

export const config = { schedule: "0 */3 * * *" };
