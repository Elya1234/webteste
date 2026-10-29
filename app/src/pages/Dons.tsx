import { useState } from "react";
import { checkout, euros, DEMO } from "../lib/backend";
import { useAuth } from "../lib/auth";
import { go } from "../lib/router";

// Motifs proposés : à ajuster avec la synagogue
export const PURPOSES = ["Don général", "Cotisation annuelle", "Kibboud / Mitsva (montée à la Torah)", "Neder", "Hazkara / Leilouy Nichmat", "Refoua Chelema", "Kiddouch / Séouda"];
const AMOUNTS = [1800, 3600, 5400, 10000, 18000];

export default function Dons({ params }: { params?: URLSearchParams }) {
  // lien « Payer » d'un rappel de paiement : montant et motif déjà remplis
  const preAmount = Number(params?.get("montant")) || 0, preMotif = params?.get("motif") || "";
  const { profile } = useAuth();
  const [amount, setAmount] = useState(AMOUNTS.includes(preAmount) ? preAmount : 3600);
  const [custom, setCustom] = useState(preAmount && !AMOUNTS.includes(preAmount) ? String(preAmount / 100).replace(".", ",") : "");
  const [purpose, setPurpose] = useState(preMotif && PURPOSES.includes(preMotif) ? preMotif : PURPOSES[0]);
  const [dedication, setDedication] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const cents = custom ? Math.round(Number(custom.replace(",", ".")) * 100) : amount;
  const valid = Number.isFinite(cents) && cents >= 100 && cents <= 10000000;

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) { go("compte", "suite=dons"); return; }
    setBusy(true); setMsg("");
    try {
      const r = await checkout({ donation: { amount_cents: cents, purpose, dedication: dedication.trim() } });
      if (r.url) { window.location.href = r.url; return; }
      go("compte", "paiement=ok");
    } catch { setMsg("Le paiement n'a pas pu démarrer. Réessayez dans un instant."); }
    setBusy(false);
  }

  return (
    <div className="page narrow">
      <form className="card" onSubmit={pay}>
        <h2 className="serif gold-text">Faire un don <span className="hebrew">צדקה</span></h2>
        <label className="field"><span>Motif</span>
          <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        <div className="field"><span>Montant</span>
          <div className="chips">{AMOUNTS.map((a) => <button type="button" key={a} className={"chip" + (!custom && a === amount ? " on" : "")} onClick={() => { setAmount(a); setCustom(""); }}>{euros(a)}</button>)}</div>
          <input className="input" inputMode="decimal" placeholder="Autre montant (€)" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d,.]/g, ""))} />
        </div>
        <label className="field"><span>Dédicace (facultatif)</span>
          <input className="input" maxLength={200} placeholder="Ex. Leilouy Nichmat …, Refoua Chelema de …" value={dedication} onChange={(e) => setDedication(e.target.value)} />
        </label>
        {DEMO && <p className="small muted">Mode démonstration : aucun paiement réel.</p>}
        {msg && <p className="error">{msg}</p>}
        <button className="btn full" disabled={!valid || busy}>{profile ? (busy ? "Ouverture du paiement…" : "Donner " + (valid ? euros(cents) : "")) : "Créer un compte ou se connecter"}</button>
        <p className="small muted">Un reçu est envoyé par e-mail après le paiement.</p>
      </form>
    </div>
  );
}
