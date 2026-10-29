import { useRoute, type Route } from "./lib/router";
import { useSynagogue } from "./lib/synagogue";
import { useCart } from "./lib/cart";
import Home from "./pages/Home";
import Horaires, { Zmanim } from "./pages/Horaires";
import Menu, { ITEMS } from "./pages/Menu";
import Siddour from "./pages/Siddour";
import Calendrier from "./pages/Calendrier";
import Etude from "./pages/Etude";
import { Cours, Galerie, Videos } from "./pages/Contenus";
import Boutique from "./pages/Boutique";
import Panier from "./pages/Panier";
import Dons from "./pages/Dons";
import Compte from "./pages/Compte";

const NAV: { r: Route; label: string; icon: string }[] = [
  { r: "accueil", label: "Accueil", icon: "M3 11 12 4l9 7v9h-6v-6H9v6H3z" },
  { r: "horaires", label: "Horaires", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2" },
  { r: "boutique", label: "Boutique", icon: "M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2" },
  { r: "compte", label: "Compte", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0" }
];
// rubriques ouvertes depuis le Menu : petit retour en haut de page (le Siddour a son propre fil d'Ariane)
const BACK_TO_MENU: Route[] = ["calendrier", "zmanim", "cours", "halakha", "daf", "videos", "galerie", "dons"];
const MENU_ICON = "M4 6h16M4 12h16M4 18h16";
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function App() {
  const { route, params } = useRoute();
  const { config } = useSynagogue();
  const lines = useCart();
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const page = {
    accueil: <Home />, horaires: <Horaires />, boutique: <Boutique />, panier: <Panier />, dons: <Dons />, compte: <Compte params={params} />,
    menu: <Menu />, siddour: <Siddour params={params} />, calendrier: <Calendrier />, zmanim: <Zmanim />, cours: <Cours />,
    halakha: <Etude kind="halakha" />, daf: <Etude kind="daf" />, videos: <Videos />, galerie: <Galerie />
  }[route];
  // les rubriques ouvertes depuis le Menu gardent l'onglet Menu allumé
  const tab = NAV.some((n) => n.r === route) ? route : route === "panier" ? "boutique" : ITEMS.some((i) => i.r === route) ? "menu" : route;

  return (
    <div className="shell">
      <header className="topbar">
        {/* Menu (3 traits) à gauche ; Maguen David et nom de la synagogue au centre ; panier à droite */}
        <a className={"menu-btn" + (tab === "menu" ? " on" : "")} href="#/menu" aria-current={route === "menu" ? "page" : undefined}><Icon d={MENU_ICON} /><span>Menu</span></a>
        <a className="brand" href="#/accueil">
          <span className="logo serif">✡&#xFE0E;</span>
          <span><span className="serif gold-text brand-name">{config.name}</span><span className="hebrew brand-he">{config.nameHe}</span></span>
        </a>
        <a className="cart-btn" href="#/panier" aria-label={"Panier, " + count + " article(s)"}>
          <Icon d={NAV[2].icon} />{count > 0 && <span className="badge">{count}</span>}
        </a>
      </header>
      <nav className="nav" aria-label="Navigation principale">
        {NAV.map((n) => (
          <a key={n.r} href={"#/" + n.r} className={tab === n.r ? "on" : ""} aria-current={route === n.r ? "page" : undefined}>
            <Icon d={n.icon} /><span>{n.label}</span>
          </a>
        ))}
      </nav>
      <main className="main">
        {BACK_TO_MENU.includes(route) && <nav className="page back-bar"><a className="crumbs" href="#/menu"><span className="gold">‹ Menu</span></a></nav>}
        {page}
      </main>
    </div>
  );
}
