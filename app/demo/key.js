// Démo hors ligne : clé stable pour chaque appel externe de l'application (partagée par l'enregistreur et la page).
export function demoKey(url) {
  const u = new URL(url);
  const h = u.hostname, p = u.pathname, q = u.searchParams;
  if (h.endsWith("hebcal.com") && p === "/zmanim") return "zmanim";
  if (h.endsWith("hebcal.com") && p === "/hebcal") return q.get("year") ? "cal-" + q.get("year") + "-" + q.get("month") : "hebcal-range";
  if (h === "script.google.com") return "remote";
  if (h.endsWith("sefaria.org") && p === "/api/calendars") return "sef-cal";
  if (h.endsWith("sefaria.org") && p.startsWith("/api/v2/raw/index/")) return "sef-index";
  if (h.endsWith("sefaria.org") && p.startsWith("/api/v3/texts/")) return "sef-t|" + decodeURIComponent(p.slice(14)) + "|" + q.getAll("version").join(",");
  return null;
}
export function fileFor(key) {
  let x = 2166136261;
  for (let i = 0; i < key.length; i++) { x ^= key.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return "demo-data/" + x.toString(16).padStart(8, "0") + ".json";
}
