// Lettura da HubSpot e aggregazione per sales e giorno.
// Chiamate = riunioni (appuntamenti telefonici) assegnate al sales, per data dell'attività.
// Esiti: Completed = risposto, No show = non risposto, Canceled = annullata,
//        Scheduled / Rescheduled = senza esito (riunione non aggiornata).
// Pagati = trattative del sales con "Data primo pagamento" (data_pagamento_wcu) nel giorno.
// Tipologia = campo "Pacchetto" della trattativa.

import { SALES, START_DATE, TIME_ZONE, LISTINO } from "./config.mjs";

const API = "https://api.hubapi.com";
const PAGE = 200; // massimo consentito dalla Search API
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(token, objectType, body) {
  const out = [];
  let after;
  for (let guard = 0; guard < 55; guard++) {
    const payload = { ...body, limit: PAGE, ...(after ? { after } : {}) };
    let res;
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch(`${API}/crm/v3/objects/${objectType}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status !== 429 && res.status < 500) break;
      await sleep(1000 * (attempt + 1)); // limite di richieste: attendo e riprovo
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HubSpot ${objectType} search ${res.status}: ${text.slice(0, 400)}`);
    }
    const json = await res.json();
    if (!after && json.total > 9900) {
      const err = new Error(`Troppi risultati (${json.total}) in una ricerca`);
      err.tooMany = true;
      throw err;
    }
    out.push(...json.results);
    after = json.paging?.next?.after;
    if (!after) break;
    await sleep(220); // la Search API accetta circa 5 richieste al secondo
  }
  return out;
}

// Giorno locale (YYYY-MM-DD) di un istante.
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export const localDay = (value) => {
  const d = /^\d+$/.test(String(value)) ? new Date(Number(value)) : new Date(value);
  return dayFmt.format(d);
};

// Finestre mensili tra due istanti, per restare sotto il limite di 10.000 risultati per ricerca.
function monthWindows(fromMs, toMs) {
  const wins = [];
  let cur = new Date(fromMs);
  while (cur.getTime() < toMs) {
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    wins.push([cur.getTime(), Math.min(next.getTime(), toMs) - 1]);
    cur = next;
  }
  return wins;
}

const meetingQuery = (ownerId, a, b) => ({
  filterGroups: [{
    filters: [
      { propertyName: "hubspot_owner_id", operator: "EQ", value: ownerId },
      { propertyName: "hs_timestamp", operator: "BETWEEN", value: String(a), highValue: String(b) },
    ],
  }],
  properties: ["hs_timestamp", "hs_meeting_outcome"],
});

export async function fetchMeetings(token, ownerId, fromMs, toMs) {
  // Una sola ricerca per tutto il periodo; se supera il limite di 10.000 risultati
  // della Search API, divido per mese.
  try {
    return await search(token, "meetings", meetingQuery(ownerId, fromMs, toMs));
  } catch (err) {
    if (!err.tooMany) throw err;
  }
  const rows = [];
  for (const [a, b] of monthWindows(fromMs, toMs)) {
    rows.push(...(await search(token, "meetings", meetingQuery(ownerId, a, b))));
  }
  return rows;
}

export async function fetchPaidDeals(token, ownerIds, fromMs, toMs) {
  return search(token, "deals", {
    filterGroups: [{
      filters: [
        { propertyName: "hubspot_owner_id", operator: "IN", values: ownerIds },
        { propertyName: "data_pagamento_wcu", operator: "BETWEEN", value: String(fromMs), highValue: String(toMs) },
      ],
    }],
    properties: ["hubspot_owner_id", "data_pagamento_wcu", "pacchetto"],
  });
}

// Trasforma i record HubSpot nei dati del dashboard (nessun dato personale dei clienti).
export function aggregate(meetingsBySales, deals, sales = SALES) {
  const nameById = Object.fromEntries(sales.map((s) => [s.id, s.name]));
  const days = new Map();
  const row = (s, d) => {
    const k = s + "|" + d;
    if (!days.has(k)) days.set(k, { s, d, calls: 0, answered: 0, noAnswer: 0, cancelled: 0, open: 0, paid: 0 });
    return days.get(k);
  };

  for (const [salesName, meetings] of Object.entries(meetingsBySales)) {
    for (const m of meetings) {
      const t = m.properties?.hs_timestamp;
      if (!t) continue;
      const r = row(salesName, localDay(t));
      r.calls++;
      const o = (m.properties.hs_meeting_outcome || "").toUpperCase();
      if (o === "COMPLETED") r.answered++;
      else if (o === "NO_SHOW") r.noAnswer++;
      else if (o === "CANCELED") r.cancelled++;
      else r.open++; // SCHEDULED, RESCHEDULED o vuoto
    }
  }

  const types = new Map();
  for (const deal of deals) {
    const p = deal.properties || {};
    const s = nameById[p.hubspot_owner_id];
    const raw = p.data_pagamento_wcu;
    if (!s || !raw) continue;
    const d = /^\d+$/.test(String(raw)) ? new Date(Number(raw)).toISOString().slice(0, 10) : String(raw).slice(0, 10);
    row(s, d).paid++;
    const pk = p.pacchetto || "";
    const li = LISTINO[pk];
    const code = li ? li.code : pk ? "ALTRO" : "ND";
    const key = [s, d.slice(0, 7), code].join("|");
    if (!types.has(key)) {
      types.set(key, {
        s, m: d.slice(0, 7), code,
        name: li ? li.name : pk ? "Altro pacchetto" : "Pacchetto non indicato",
        price: li ? li.price : null, n: 0,
      });
    }
    types.get(key).n++;
  }

  const byKey = (a, b) => (a.s + a.d).localeCompare(b.s + b.d);
  return {
    days: [...days.values()].sort(byKey),
    types: [...types.values()].sort((a, b) => (a.s + a.m + a.code).localeCompare(b.s + b.m + b.code)),
  };
}

export async function buildData(token, now = new Date()) {
  const fromMs = Date.parse(START_DATE + "T00:00:00Z");
  const toMs = now.getTime();
  const meetingsBySales = {};
  for (const s of SALES) meetingsBySales[s.name] = await fetchMeetings(token, s.id, fromMs, toMs);
  const deals = await fetchPaidDeals(token, SALES.map((s) => s.id), fromMs, toMs);
  const { days, types } = aggregate(meetingsBySales, deals);
  return {
    updatedAt: now.toISOString(),
    from: START_DATE,
    to: localDay(toMs),
    sales: SALES.map(({ name, fullName }) => ({ name, fullName })),
    listino: Object.values(LISTINO),
    counts: { meetings: Object.values(meetingsBySales).reduce((a, m) => a + m.length, 0), paidDeals: deals.length },
    days,
    types,
  };
}
