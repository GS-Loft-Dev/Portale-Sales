// Protezione con password: se DASHBOARD_PASSWORD è impostata, il sito chiede utente e password.
// Utente: qualsiasi (es. "gsloft"); password: il valore di DASHBOARD_PASSWORD.
export default async (request, context) => {
  const password = Netlify.env.get("DASHBOARD_PASSWORD");
  if (!password) return context.next();
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === password) return context.next();
    } catch (_) { /* intestazione non valida */ }
  }
  return new Response("Accesso riservato", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Performance Sales GS LOFT", charset="UTF-8"' },
  });
};

export const config = { path: "/*" };
