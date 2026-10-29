import { useEffect, useState } from "react";
import { EMPTY_ASSOCIATION, getAssociation, type Association } from "../lib/backend";
import { saveAssociation } from "../lib/admin";

/* Administration › Association : ces informations apparaissent sur les reçus, les reçus fiscaux et les pages légales. */
export default function AdminAssociation() {
  const [a, setA] = useState<Association | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { getAssociation().then(setA, () => setA(EMPTY_ASSOCIATION)); }, []);
  if (!a) return <div className="card muted">Chargement…</div>;
  const set = (k: keyof Association) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setA({ ...a, [k]: e.target.value }); setMsg(""); };
  const missing = [!a.legal_name && "nom officiel", !a.address && "adresse", !a.city && "ville", !a.rna && !a.siret && "RNA ou SIRET", !a.object && "objet"].filter(Boolean);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (a!.tax_receipts && missing.length) { setMsg("Pour les reçus fiscaux, il manque : " + missing.join(", ") + "."); return; }
    setBusy(true);
    try { await saveAssociation({ ...a!, rna: a!.rna.trim().toUpperCase(), siret: a!.siret.replace(/\s/g, "") }); setMsg("Enregistré."); } catch { setMsg("Enregistrement impossible. Réessayez."); }
    setBusy(false);
  }
  return (
    <form className="card" onSubmit={submit}>
      <h2 className="serif gold-text">Fiche de l'association</h2>
      <p className="small muted">Ces informations figurent sur les reçus, les reçus fiscaux et les pages Confidentialité et Conditions de vente.</p>
      <label className="field"><span>Nom officiel (comme sur les statuts)</span><input id="a-name" className="input" maxLength={200} value={a.legal_name} onChange={set("legal_name")} placeholder="Association cultuelle …" /></label>
      <label className="field"><span>Adresse</span><input id="a-addr" className="input" maxLength={200} value={a.address} onChange={set("address")} /></label>
      <div className="grid-2 tight">
        <label className="field"><span>Code postal</span><input id="a-cp" className="input num" inputMode="numeric" maxLength={10} value={a.postal_code} onChange={set("postal_code")} /></label>
        <label className="field"><span>Ville</span><input id="a-city" className="input" maxLength={80} value={a.city} onChange={set("city")} /></label>
      </div>
      <div className="grid-2 tight">
        <label className="field"><span>N° RNA (W…)</span><input id="a-rna" className="input num" maxLength={20} value={a.rna} onChange={set("rna")} placeholder="W751234567" /></label>
        <label className="field"><span>N° SIRET (facultatif)</span><input id="a-siret" className="input num" inputMode="numeric" maxLength={20} value={a.siret} onChange={set("siret")} /></label>
      </div>
      <label className="field"><span>Objet de l'association</span><textarea id="a-obj" className="input" rows={2} maxLength={400} value={a.object} onChange={set("object")} placeholder="Exercice public du culte israélite" /></label>
      <div className="grid-2 tight">
        <label className="field"><span>E-mail de contact</span><input id="a-mail" className="input" type="email" maxLength={120} value={a.email} onChange={set("email")} /></label>
        <label className="field"><span>Téléphone</span><input id="a-tel" className="input" type="tel" maxLength={30} value={a.phone} onChange={set("phone")} /></label>
      </div>
      <label className="field"><span>Président(e) (signataire des reçus fiscaux)</span><input id="a-pres" className="input" maxLength={120} value={a.president} onChange={set("president")} /></label>
      <label className="field"><span>Type d'organisme</span>
        <select id="a-cat" className="input" value={a.category} onChange={(e) => setA({ ...a, category: e.target.value as Association["category"] })}>
          <option value="cultuelle">Association cultuelle (loi 1905)</option>
          <option value="interet_general">Association loi 1901 d'intérêt général</option>
          <option value="utilite_publique">Association reconnue d'utilité publique</option>
        </select></label>
      <label className="check"><input type="checkbox" checked={a.tax_receipts} onChange={(e) => { setA({ ...a, tax_receipts: e.target.checked }); setMsg(""); }} />
        L'association peut délivrer des reçus fiscaux (association cultuelle ou d'intérêt général, article 200 du CGI)</label>
      {a.tax_receipts && <p className="small muted">Chaque donateur pourra afficher son reçu fiscal (Cerfa n° 11580) depuis son reçu de don : réduction d'impôt de 66 % du montant. Vérifiez votre éligibilité avec votre expert-comptable.</p>}
      {msg && <p className={"small " + (msg === "Enregistré." ? "gold" : "error")}>{msg}</p>}
      <button className="btn full" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
    </form>
  );
}
