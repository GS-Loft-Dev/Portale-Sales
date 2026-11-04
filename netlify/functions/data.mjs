// Restituisce alla pagina gli ultimi dati salvati dalla funzione refresh.
import { getStore } from "@netlify/blobs";
import { STORE_NAME, DATA_KEY } from "../lib/config.mjs";

export default async () => {
  const store = getStore(STORE_NAME);
  const [data, lastError] = await Promise.all([
    store.get(DATA_KEY, { type: "json" }),
    store.get("last-error.json", { type: "json" }),
  ]);
  if (!data) {
    return Response.json(
      { error: "Dati non ancora disponibili: esegui la funzione refresh (Netlify > Functions > refresh > Run now).", lastError },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const stale = lastError && lastError.at > data.updatedAt ? lastError : null;
  return Response.json({ ...data, lastError: stale }, { headers: { "Cache-Control": "no-store" } });
};

export const config = { path: "/api/data" };
