import { useEffect, useState } from "react";
import { euros, METHOD, taxReceiptNumber, type Association, type Order, type Profile } from "../lib/backend";
import { eurosInWords } from "../lib/words";

/* Reçu fiscal (modèle Cerfa n° 11580) : dons à certains organismes d'intérêt général, articles 200, 238 bis et 978 du CGI.
 * Toujours en français : c'est un document administratif. Le numéro d'ordre est attribué par le serveur, à la suite. */
const CAT: [Association["category"], string][] = [
  ["utilite_publique", "Association ou fondation reconnue d'utilité publique"],
  ["interet_general", "Œuvre ou organisme d'intérêt général"],
  ["cultuelle", "Association cultuelle ou de bienfaisance et établissement public des cultes reconnus d'Alsace-Moselle"]
];
const MODE: Record<string, string> = { card: "Carte bancaire", apple_pay: "Carte bancaire (Apple Pay)", google_pay: "Carte bancaire (Google Pay)", sepa_debit: "Prélèvement / virement", link: "Carte bancaire" };

export default function RecuFiscal({ order, asso, donor }: { order: Order; asso: Association; donor: Profile }) {
  const [no, setNo] = useState<number | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { taxReceiptNumber(order.id).then(setNo, () => setErr("Le numéro du reçu n'a pas pu être attribué. Réessayez avec Internet.")); }, [order.id]);
  const amount = order.total_cents - (order.refunded_cents || 0);
  const year = new Date(order.created_at).getFullYear();
  const box = (on: boolean) => <span className={"cerfa-box" + (on ? " on" : "")} aria-hidden="true">{on ? "✕" : ""}</span>;
  if (err) return <p className="error">{err}</p>;
  return (
    <div className="cerfa">
      <header className="cerfa-head">
        <div className="small">Cerfa n° 11580</div>
        <h2>Reçu au titre des dons à certains organismes d'intérêt général</h2>
        <div className="small">Articles 200, 238 bis et 978 du code général des impôts</div>
        <div className="cerfa-no">Numéro d'ordre du reçu : <b className="num">{no ? year + "-" + String(no).padStart(5, "0") : "…"}</b></div>
      </header>
      <section>
        <h3>Bénéficiaire des versements</h3>
        <p><b>{asso.legal_name}</b><br />{asso.address}<br />{asso.postal_code} {asso.city}{asso.rna && <><br />N° RNA : {asso.rna}</>}{asso.siret && <> · SIRET : {asso.siret}</>}</p>
        <p>Objet : {asso.object}</p>
        <ul className="cerfa-list">{CAT.map(([k, l]) => <li key={k}>{box(asso.category === k)} {l}</li>)}</ul>
      </section>
      <section>
        <h3>Donateur</h3>
        <p><b>{[donor.last_name.toUpperCase(), donor.first_name].filter(Boolean).join(" ")}</b><br />{donor.address}<br />{donor.postal_code} {donor.city}</p>
      </section>
      <section>
        <h3>Le bénéficiaire reconnaît avoir reçu au titre des dons et versements ouvrant droit à réduction d'impôt la somme de :</h3>
        <p className="cerfa-amount num">{euros(amount)}</p>
        <p>Somme en toutes lettres : <b>{eurosInWords(amount)}</b></p>
        <p>Date du versement : <b>{new Date(order.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}</b></p>
        <p>Le bénéficiaire certifie sur l'honneur que les dons et versements qu'il reçoit ouvrent droit à la réduction d'impôt prévue à l'article :</p>
        <ul className="cerfa-list"><li>{box(true)} 200 du CGI</li><li>{box(false)} 238 bis du CGI</li><li>{box(false)} 978 du CGI</li></ul>
        <div className="cerfa-cols">
          <div><b>Forme du don</b><ul className="cerfa-list"><li>{box(false)} Acte authentique</li><li>{box(false)} Acte sous seing privé</li><li>{box(true)} Déclaration de don manuel</li><li>{box(false)} Autres</li></ul></div>
          <div><b>Nature du don</b><ul className="cerfa-list"><li>{box(true)} Numéraire</li><li>{box(false)} Titres de sociétés cotés</li><li>{box(false)} Autres</li></ul></div>
          <div><b>Mode de versement</b><ul className="cerfa-list"><li>{box(false)} Remise d'espèces</li><li>{box(false)} Chèque</li>
            <li>{box(true)} Virement, prélèvement, carte bancaire{order.payment_method ? " (" + (MODE[order.payment_method] || METHOD[order.payment_method] || order.payment_method) + ")" : ""}</li></ul></div>
        </div>
      </section>
      <footer className="cerfa-sign">
        <div>Fait le {new Date().toLocaleDateString("fr-FR")}<br />{asso.president && <>{asso.president}, président(e)</>}</div>
        <div className="small muted">Réduction d'impôt : 66 % du montant, dans la limite de 20 % du revenu imposable, soit {euros(Math.round(amount * 0.66))} pour ce don (coût réel {euros(amount - Math.round(amount * 0.66))}).</div>
      </footer>
    </div>
  );
}
