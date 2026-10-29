/* Navigation par « # » : marche pareil dans le navigateur, l'appli installée et Capacitor (fichiers locaux). */
import { useEffect, useState } from "react";

export const ROUTES = ["accueil", "horaires", "boutique", "panier", "dons", "compte", "menu",
  "siddour", "calendrier", "zmanim", "cours", "halakha", "daf", "videos", "galerie", "admin", "messages", "paiement", "recu", "confidentialite", "conditions", "recu-annuel"] as const;
export type Route = (typeof ROUTES)[number];

function parse(): { route: Route; params: URLSearchParams } {
  const [path, q] = window.location.hash.replace(/^#\/?/, "").split("?");
  return { route: (ROUTES as readonly string[]).includes(path) ? (path as Route) : "accueil", params: new URLSearchParams(q || "") };
}

export function useRoute() {
  const [r, setR] = useState(parse);
  useEffect(() => { const f = () => { setR(parse()); window.scrollTo(0, 0); }; window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return r;
}
export const go = (route: Route, q = "") => { window.location.hash = "/" + route + (q ? "?" + q : ""); };
