/* Version de démonstration (page claude.ai, sans accès à Internet) : les appels à Hebcal, Sefaria et à la base
 * Google sont servis par des copies enregistrées le jour de la publication (demo-data/). */
// @ts-expect-error module JS partagé avec l'enregistreur
import { demoKey, fileFor } from "../demo/key.js";

if (import.meta.env.VITE_DEMO === "1") {
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let key: string | null = null;
    try { key = demoKey(new URL(url, location.href).href); } catch { /* adresse relative */ }
    if (!key) return real(input, init);
    return real(fileFor(key)).then((r) => { if (!r.ok) throw new TypeError("Hors ligne (démo)"); return r; });
  };
}
