import { useState } from "react";
import { demoComplete, demoPending, euros } from "../lib/backend";
import { cart } from "../lib/cart";
import { go } from "../lib/router";
import { t } from "../lib/i18n";

/* Démonstration uniquement : reproduit la page de paiement Stripe (carte, Apple Pay, Google Pay, SEPA).
 * Dans la vraie application, c'est la page sécurisée de Stripe qui s'ouvre ; la carte ne passe jamais par nos serveurs. */
type Method = "card" | "apple_pay" | "google_pay" | "sepa_debit";
const digits = (s: string) => s.replace(/\D/g, "");

export default function Paiement() {
  const p = demoPending();
  const [method, setMethod] = useState<Method>("card");
  const [card, setCard] = useState({ num: "", exp: "", cvc: "", name: "" });
  const [iban, setIban] = useState({ iban: "", name: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!p) return <div className="page narrow"><div className="card"><p className="muted">{t("Rien à payer.")}</p><button className="btn" onClick={() => go("accueil")}>{t("Retour")}</button></div></div>;
  const monthly = "donation" in p.body && p.body.donation.monthly;

  function pay(e?: React.FormEvent) {
    e?.preventDefault(); setErr("");
    if (method === "card") {
      const n = digits(card.num);
      if (n.length < 15 || !/^\d{2}\/\d{2}$/.test(card.exp) || digits(card.cvc).length < 3) { setErr(t("Vérifiez les informations de la carte.")); return; }
      if (n === "4000000000000002") { setErr(t("Carte refusée. Essayez la carte de test 4242 4242 4242 4242.")); return; }
    }
    if (method === "sepa_debit" && (digits(iban.iban).length < 10 || !iban.name.trim())) { setErr(t("Vérifiez l'IBAN et le titulaire.")); return; }
    setBusy(true);
    setTimeout(() => {
      demoComplete(method);
      if ("cart" in p!.body) cart.clear();
      go("compte", "paiement=" + (method === "sepa_debit" ? "sepa" : "ok"));
    }, 1200);
  }

  return (
    <div className="page narrow">
      <section className="card pay">
        <div className="pay-head">
          <span className="small muted">{t("Paiement sécurisé")} · Stripe</span>
          <b className="serif">{t(p.label)}</b>
          <b className="num gold-text pay-amount">{euros(p.total)}{monthly && <span className="small muted"> / {t("mois")}</span>}</b>
        </div>
        <div className="pay-methods" role="tablist">
          {([["card", t("Carte bancaire")], ["apple_pay", "Apple Pay"], ["google_pay", "Google Pay"], ["sepa_debit", t("Prélèvement SEPA")]] as [Method, string][]).map(([m, l]) => (
            <button key={m} type="button" role="tab" aria-selected={method === m} className={method === m ? "on" : ""} onClick={() => { setMethod(m); setErr(""); }}>{l}</button>
          ))}
        </div>
        {method === "card" && (
          <form onSubmit={pay}>
            <label className="field"><span>{t("Numéro de carte")}</span>
              <input id="pay-num" className="input num" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.num}
                onChange={(e) => setCard({ ...card, num: digits(e.target.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ") })} /></label>
            <div className="grid-2 tight">
              <label className="field"><span>{t("Expiration")}</span><input id="pay-exp" className="input num" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={card.exp}
                onChange={(e) => { const d = digits(e.target.value).slice(0, 4); setCard({ ...card, exp: d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d }); }} /></label>
              <label className="field"><span>{t("Cryptogramme")}</span><input id="pay-cvc" className="input num" inputMode="numeric" autoComplete="cc-csc" placeholder="123" value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: digits(e.target.value).slice(0, 4) })} /></label>
            </div>
            <button className="btn full" disabled={busy}>{busy ? t("Paiement en cours…") : t("Payer {m}", { m: euros(p.total) })}</button>
          </form>
        )}
        {(method === "apple_pay" || method === "google_pay") && (
          <button className={"btn full wallet " + method} disabled={busy} onClick={() => pay()}>{busy ? t("Paiement en cours…") : method === "apple_pay" ? t("Payer avec Apple Pay") : t("Payer avec Google Pay")}</button>
        )}
        {method === "sepa_debit" && (
          <form onSubmit={pay}>
            <label className="field"><span>{t("Titulaire du compte")}</span><input id="pay-holder" className="input" value={iban.name} onChange={(e) => setIban({ ...iban, name: e.target.value })} /></label>
            <label className="field"><span>{t("IBAN")}</span><input id="pay-iban" className="input num" placeholder="FR76 3000 6000 0112 3456 7890 189" value={iban.iban}
              onChange={(e) => setIban({ ...iban, iban: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 34).replace(/(.{4})(?=.)/g, "$1 ") })} /></label>
            <p className="small muted">{t("Le prélèvement est confirmé par la banque en 3 à 5 jours.")}</p>
            <button className="btn full" disabled={busy}>{busy ? t("Paiement en cours…") : t("Payer {m}", { m: euros(p.total) })}</button>
          </form>
        )}
        {err && <p className="error">{err}</p>}
        <p className="small muted">{t("Démonstration : utilisez la carte 4242 4242 4242 4242, aucune somme n'est prélevée.")}</p>
        <button className="link" onClick={() => go("compte", "paiement=annule")}>{t("Annuler")}</button>
      </section>
    </div>
  );
}
