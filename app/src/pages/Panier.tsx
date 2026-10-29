import { useState } from "react";
import { checkout, euros, DEMO } from "../lib/backend";
import { cart, useCart } from "../lib/cart";
import { useAuth } from "../lib/auth";
import { go } from "../lib/router";
import { useProducts } from "./Boutique";

export default function Panier() {
  const lines = useCart();
  const { products } = useProducts();
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const find = (id: string) => products?.find((p) => p.id === id);
  const total = lines.reduce((s, l) => s + (find(l.product_id)?.price_cents || 0) * l.qty, 0);

  async function pay() {
    if (!profile) { go("compte", "suite=panier"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await checkout({ cart: lines });
      if (r.url) { window.location.href = r.url; return; }
      cart.clear(); go("compte", "paiement=ok");
    } catch { setMsg("Le paiement n'a pas pu démarrer. Réessayez dans un instant."); }
    setBusy(false);
  }

  if (!lines.length) return <div className="page"><div className="card"><p>Votre panier est vide.</p><button className="btn" onClick={() => go("boutique")}>Voir la boutique</button></div></div>;
  return (
    <div className="page narrow">
      <section className="card">
        <h2 className="serif gold-text">Panier</h2>
        {lines.map((l, i) => {
          const p = find(l.product_id);
          return (
            <div key={i} className="cart-line">
              <div><b>{p?.name || "…"}</b><div className="small muted">Réf. {p?.ref}{l.comment && <> · « {l.comment} »</>}</div></div>
              <div className="qty">
                <button className="btn ghost sm" aria-label="Moins" onClick={() => cart.setQty(i, l.qty - 1)}>−</button>
                <span className="num">{l.qty}</span>
                <button className="btn ghost sm" aria-label="Plus" onClick={() => cart.setQty(i, l.qty + 1)}>+</button>
              </div>
              <b className="num">{euros((p?.price_cents || 0) * l.qty)}</b>
            </div>
          );
        })}
        <div className="cart-total"><span>Total</span><b className="gold-text num">{euros(total)}</b></div>
        {!profile && <p className="small muted">Un compte est nécessaire pour payer : vous retrouverez vos commandes et reçus.</p>}
        {DEMO && <p className="small muted">Mode démonstration : aucun paiement réel.</p>}
        {msg && <p className="error">{msg}</p>}
        <button className="btn full" disabled={busy} onClick={pay}>{profile ? (busy ? "Ouverture du paiement…" : "Payer " + euros(total)) : "Créer un compte ou se connecter"}</button>
      </section>
    </div>
  );
}
