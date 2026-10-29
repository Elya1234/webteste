import { t } from "../lib/i18n";
import { useEffect, useState } from "react";
import { euros, listProducts, type Product } from "../lib/backend";
import { cart } from "../lib/cart";
import { go } from "../lib/router";

export function useProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { listProducts().then(setProducts, () => setError(t("Impossible de charger la boutique. Vérifiez votre connexion."))); }, []);
  return { products, error };
}

export default function Boutique() {
  const { products, error } = useProducts();
  const [cat, setCat] = useState("Tout");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Product | null>(null);
  const [comment, setComment] = useState("");
  const [added, setAdded] = useState("");

  if (error) return <div className="page"><div className="card">{error}</div></div>;
  if (!products) return <div className="page"><div className="card muted">{t("Chargement…")}</div></div>;
  const cats = ["Tout", ...Array.from(new Set(products.map((p) => p.category)))];
  const s = q.trim().toLowerCase();
  const shown = products.filter((p) => (cat === "Tout" || p.category === cat) && (!s || (p.name + " " + p.ref + " " + p.description).toLowerCase().includes(s)));

  function add(p: Product, c = "") {
    cart.add(p.id, c.trim());
    setPicked(null); setComment("");
    setAdded(p.name); setTimeout(() => setAdded(""), 2500);
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input className="input" type="search" placeholder={t("Rechercher (nom ou référence)")} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">{cats.map((c) => <button key={c} className={"chip" + (c === cat ? " on" : "")} onClick={() => setCat(c)}>{t(c)}</button>)}</div>
      </div>
      <div className="products">
        {shown.map((p) => (
          <article key={p.id} className="card product">
            <div className="p-img">{p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <span className="serif gold-text">✡</span>}</div>
            <div className="p-ref small muted">{t("Réf. {r}", { r: p.ref })}</div>
            <h3 className="serif">{p.name}</h3>
            <p className="small">{p.description}</p>
            <div className="p-foot">
              <b className="gold-text num">{euros(p.price_cents)}</b>
              <button className="btn" disabled={p.stock === 0} onClick={() => (p.comment_label ? setPicked(p) : add(p))}>{p.stock === 0 ? t("Épuisé") : t("Ajouter")}</button>
            </div>
          </article>
        ))}
        {!shown.length && <div className="muted">{t("Aucun article trouvé.")}</div>}
      </div>

      {picked && (
        <div className="sheet-bg" onClick={() => setPicked(null)}>
          <form className="sheet card" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); add(picked, comment); }}>
            <h3 className="serif">{picked.name}</h3>
            <label className="field"><span>{picked.comment_label}</span>
              <textarea className="input" required rows={3} maxLength={300} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
            </label>
            <div className="row-end"><button type="button" className="btn ghost" onClick={() => setPicked(null)}>{t("Annuler")}</button><button className="btn">{t("Ajouter au panier")}</button></div>
          </form>
        </div>
      )}
      {added && <button className="toast" onClick={() => go("panier")}>{t("« {n} » ajouté · Voir le panier", { n: added })}</button>}
    </div>
  );
}
