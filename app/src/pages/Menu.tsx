import { useState } from "react";
import { useSynagogue } from "../lib/synagogue";
import type { Route } from "../lib/router";

// Icônes simples au trait (même style que la barre de navigation)
export const ITEMS: { r: Route; label: string; he: string; sub: string; icon: string }[] = [
  { r: "horaires", label: "Horaires", he: "תפילות", sub: "Offices de la synagogue", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2" },
  { r: "siddour", label: "Siddour", he: "סידור", sub: "Rite séfarade (Edot HaMizrah)", icon: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 16V5m4 2h7" },
  { r: "calendrier", label: "Calendrier", he: "לוח שנה", sub: "Calendrier juif, fêtes, Roch Hodech", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { r: "zmanim", label: "Zmanim", he: "זמני היום", sub: "Heures halakhiques du jour", icon: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" },
  { r: "cours", label: "Cours à la synagogue", he: "שיעורים", sub: "Programme des cours", icon: "M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5" },
  { r: "halakha", label: "Halakha Yomit", he: "הלכה יומית", sub: "Choulhan Aroukh du jour", icon: "M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4" },
  { r: "videos", label: "Cours en vidéo", he: "שיעורי וידאו", sub: "Cours filmés", icon: "M3 6h13v12H3zM16 10l5-3v10l-5-3" },
  { r: "daf", label: "Daf Hayomi", he: "דף היומי", sub: "La page de Guemara du jour", icon: "M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z" },
  { r: "galerie", label: "Galerie", he: "גלריה", sub: "Photos de la synagogue", icon: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15 9.5a1.5 1.5 0 1 0 0-.01" },
  { r: "boutique", label: "Boutique", he: "חנות", sub: "Livres, objets, dédicaces", icon: "M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2" },
  { r: "dons", label: "Dons", he: "צדקה", sub: "Don, cotisation, kibboud", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" }
];

export const LineIcon = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export default function Menu() {
  const { config, bundle } = useSynagogue();
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const shown = ITEMS.filter((i) => !s || (i.label + " " + i.sub + " " + i.he).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(s));
  return (
    <div className="page narrow">
      <section className="banner" style={{ backgroundImage: "linear-gradient(180deg, rgba(4,10,28,.25), rgba(4,10,28,.7)), url(synagogue-bg.jpg)" }}>
        <div className="banner-txt"><div className="serif gold-text banner-name">{config.name}</div><div>{config.cityLabel || bundle?.location.city || ""}</div></div>
      </section>
      <input className="input" type="search" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une rubrique" />
      <ul className="menu-list card">
        {shown.map((i) => (
          <li key={i.r}><a href={"#/" + i.r}>
            <span className="menu-ic"><LineIcon d={i.icon} /></span>
            <span className="menu-t"><b>{i.label}</b><span className="small muted">{i.sub}</span></span>
            <span className="hebrew muted small">{i.he}</span>
          </a></li>
        ))}
        {!shown.length && <li className="muted" style={{ padding: 16 }}>Aucune rubrique trouvée.</li>}
      </ul>
    </div>
  );
}
