// Configurazione del dashboard Performance Sales.
// Per aggiungere un sales: aggiungi una riga con il suo ID proprietario HubSpot (owner ID).
// L'ID si trova in HubSpot > Impostazioni > Utenti e team, oppure chiedendolo a Claude.

export const SALES = [
  { id: "85641633", name: "Alessandro", fullName: "Alessandro Pozzi" },
  { id: "86170897", name: "Lorenzo", fullName: "Lorenzo Tutino" },
  { id: "1534470761", name: "Ester", fullName: "Ester Di Sava" },
];

// Primo giorno di dati da leggere.
export const START_DATE = "2025-12-01";

// Fuso orario usato per assegnare ogni appuntamento al suo giorno.
export const TIME_ZONE = "Europe/Rome";

// Listino: valore interno del campo "Pacchetto" della trattativa in HubSpot -> codice, nome e prezzo.
export const LISTINO = {
  "starter check 360": { code: "SC", name: "Starter Check Up", price: 190 },
  "Ultra Fast Program": { code: "UFP", name: "Ultra Fast Program", price: 390 },
  "Super Fast Program": { code: "SFP", name: "Super Fast / Foundation Program", price: 990 },
};

// Nome dello store Netlify Blobs e della chiave dove si salvano i dati.
export const STORE_NAME = "performance-sales";
export const DATA_KEY = "data.json";
