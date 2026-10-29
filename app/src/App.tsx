import { useRoute, type Route } from "./lib/router";
import { useSynagogue } from "./lib/synagogue";
import { useCart } from "./lib/cart";
import Home from "./pages/Home";
import Horaires from "./pages/Horaires";
import Boutique from "./pages/Boutique";
import Panier from "./pages/Panier";
import Dons from "./pages/Dons";
import Compte from "./pages/Compte";

const NAV: { r: Route; label: string; icon: string }[] = [
  { r: "accueil", label: "Accueil", icon: "M3 11 12 4l9 7v9h-6v-6H9v6H3z" },
  { r: "horaires", label: "Horaires", icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3.5 2" },
  { r: "boutique", label: "Boutique", icon: "M5 8h14l-1.2 12H6.2zM9 8V6a3 3 0 0 1 6 0v2" },
  { r: "dons", label: "Dons", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" },
  { r: "compte", label: "Compte", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0" }
];
const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>;

export default function App() {
  const { route, params } = useRoute();
  const { config } = useSynagogue();
  const lines = useCart();
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const page = { accueil: <Home />, horaires: <Horaires />, boutique: <Boutique />, panier: <Panier />, dons: <Dons />, compte: <Compte params={params} /> }[route];

  return (
    <div className="shell">
      <header className="topbar">
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
          <a key={n.r} href={"#/" + n.r} className={route === n.r || (n.r === "boutique" && route === "panier") ? "on" : ""} aria-current={route === n.r ? "page" : undefined}>
            <Icon d={n.icon} /><span>{n.label}</span>
          </a>
        ))}
      </nav>
      <main className="main">{page}</main>
    </div>
  );
}
