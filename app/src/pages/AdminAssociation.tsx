import { useEffect, useState } from "react";
import { EMPTY_ASSOCIATION, getAssociation, type Association } from "../lib/backend";
import { listMembers, listTaxReceipts, saveAssociation, toCsv, type IssuedReceipt, type Member } from "../lib/admin";
import { euros } from "../lib/backend";

/* Administration › Association : ces informations apparaissent sur les reçus, les reçus fiscaux et les pages légales. */
function Issued() {
  const [rows, setRows] = useState<IssuedReceipt[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(() => { listTaxReceipts().then(setRows, () => setRows([])); listMembers().then(setMembers, () => {}); }, []);
  const name = (id: string | null) => { const m = members.find((x) => x.id === id); return m ? [m.last_name.toUpperCase(), m.first_name].filter(Boolean).join(" ") || m.email : "Compte supprimé"; };
  if (!rows) return null;
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv([["N°", "Type", "Année", "Donateur", "Montant (€)", "Date"], ...rows.map((r) => [r.year + "-" + String(r.no).padStart(5, "0"), r.kind === "annuel" ? "Annuel" : "Don",
      r.year, name(r.user_id), (r.total_cents / 100).toFixed(2), r.date ? new Date(r.date).toLocaleDateString("fr-FR") : ""])])], { type: "text/csv;charset=utf-8" }));
    const l = document.createElement("a"); l.href = url; l.download = "recus-fiscaux.csv"; l.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <section className="card">
      <div className="card-head"><h2 className="serif gold-text">Reçus fiscaux émis</h2>{rows.length > 0 && <button className="btn ghost" onClick={exportCsv}>Exporter (Excel)</button>}</div>
      {!rows.length ? <p className="muted">Aucun reçu fiscal émis pour le moment.</p> : (
        <ul className="admin-list">{rows.map((r) => (
          <li key={r.kind + r.no}><div><b className="num">{r.year}-{String(r.no).padStart(5, "0")}</b> · {name(r.user_id)}<div className="small muted">{r.kind === "annuel" ? "Reçu annuel " + r.year : "Don du " + (r.date ? new Date(r.date).toLocaleDateString("fr-FR") : "—")}</div></div><b className="num">{euros(r.total_cents)}</b></li>
        ))}</ul>
      )}
      <p className="small muted">La liste à conserver pour la comptabilité : chaque reçu porte un numéro unique, à la suite.</p>
    </section>
  );
}

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
    <div className="stack">
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
      {a.tax_receipts && (
        <label className="field"><span>Reçus fiscaux</span>
          <select id="a-mode" className="input" value={a.receipt_mode} onChange={(e) => setA({ ...a, receipt_mode: e.target.value as Association["receipt_mode"] })}>
            <option value="per_donation">Un reçu pour chaque don (aussitôt après le paiement)</option>
            <option value="annual">Un reçu par an pour tous les dons (disponible à partir du 1er janvier suivant)</option>
          </select>
          <span className="small muted">Ne changez pas de choix en cours d'année : un même don ne doit jamais figurer sur deux reçus fiscaux.</span>
        </label>
      )}
      {a.tax_receipts && <p className="small muted">Chaque donateur pourra afficher son reçu fiscal (Cerfa n° 11580) depuis son reçu de don : réduction d'impôt de 66 % du montant. Vérifiez votre éligibilité avec votre expert-comptable.</p>}
      {msg && <p className={"small " + (msg === "Enregistré." ? "gold" : "error")}>{msg}</p>}
      <button className="btn full" disabled={busy}>{busy ? "…" : "Enregistrer"}</button>
    </form>
    {a.tax_receipts && <Issued />}
    </div>
  );
}
