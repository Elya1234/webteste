import { useEffect, useState } from "react";
import { euros, getAssociation, getOrder, METHOD, type Association, type Order } from "../lib/backend";
import RecuFiscal from "./RecuFiscal";
import { useAuth } from "../lib/auth";
import { useSynagogue } from "../lib/synagogue";
import { loc, t } from "../lib/i18n";
import { STATUS } from "./Compte";

/* Reçu d'un achat ou d'un don (à garder, imprimer ou enregistrer en PDF depuis le téléphone). */
export default function Recu({ params }: { params: URLSearchParams }) {
  const id = params.get("id") || "";
  const { profile } = useAuth();
  const { config } = useSynagogue();
  const [o, setO] = useState<Order | null | undefined>(undefined);
  const [asso, setAsso] = useState<Association | null>(null);
  const fiscal = params.get("fiscal") === "1";
  useEffect(() => { getOrder(id).then(setO, () => setO(null)); getAssociation().then(setAsso, () => {}); }, [id]);
  if (o === undefined) return <div className="page narrow"><div className="card muted">{t("Chargement…")}</div></div>;
  if (!o) return <div className="page narrow"><div className="card">{t("Reçu introuvable.")} <a className="gold" href="#/compte">{t("‹ Mon compte")}</a></div></div>;
  const items = o.order_items || [];
  const canFiscal = !!asso?.tax_receipts && o.kind === "donation" && o.status === "paid" && o.total_cents > (o.refunded_cents || 0);
  const addressOk = !!(profile?.address && profile.postal_code && profile.city && profile.last_name);
  if (fiscal && canFiscal && profile) return (
    <div className="page narrow">
      <nav className="crumbs no-print"><a href={"#/recu?id=" + encodeURIComponent(o.id)}>‹ {t("Reçu de don")}</a></nav>
      <article className="card receipt">
        {addressOk ? <RecuFiscal order={o} asso={asso!} donor={profile} />
          : <p>{t("Pour le reçu fiscal, ajoutez votre adresse dans Mon compte.")} <a className="gold" href="#/compte">{t("‹ Mon compte")}</a></p>}
        {addressOk && <div className="row-end no-print"><button className="btn" onClick={() => window.print()}>{t("Imprimer ou enregistrer en PDF")}</button></div>}
      </article>
    </div>
  );
  return (
    <div className="page narrow">
      <nav className="crumbs no-print"><a href="#/compte">{t("‹ Mon compte")}</a></nav>
      <article className="card receipt">
        <header className="receipt-head">
          <div><b className="serif gold-text receipt-org">{asso?.legal_name || config.name}</b><div className="hebrew muted">{config.nameHe}</div>{asso?.address && <div className="small muted">{asso.address}, {asso.postal_code} {asso.city}</div>}{(asso?.email || config.footerRight) && <div className="small muted">{asso?.email || config.footerRight}</div>}</div>
          <div className="right"><b>{t(o.kind === "shop" ? "Reçu d'achat" : "Reçu de don")}</b><div className="small muted num">N° {o.id.slice(0, 8).toUpperCase()}</div>
            <div className="small muted">{new Date(o.created_at).toLocaleString(loc(), { dateStyle: "long", timeStyle: "short" })}</div></div>
        </header>
        {profile && <p className="small">{t("Pour")} : <b>{[profile.first_name, profile.last_name].filter(Boolean).join(" ")}</b> · {profile.email}</p>}
        <table className="receipt-table">
          <thead><tr><th>{t("Désignation")}</th><th className="right">{t("Qté")}</th><th className="right">{t("Montant")}</th></tr></thead>
          <tbody>
            {items.length ? items.map((it, i) => (
              <tr key={i}><td>{it.name}<div className="small muted">{t("Réf. {r}", { r: it.ref })}{it.comment && " · « " + it.comment + " »"}</div></td><td className="right num">{it.qty}</td><td className="right num">{euros(it.unit_cents * it.qty)}</td></tr>
            )) : (
              <tr><td>{t(o.purpose || o.label)}{o.stripe_subscription_id && " · " + t("Chaque mois")}{o.dedication && <div className="small muted">« {o.dedication} »</div>}</td><td className="right num">1</td><td className="right num">{euros(o.total_cents)}</td></tr>
            )}
          </tbody>
          <tfoot><tr><td colSpan={2}>{t("Total")}</td><td className="right num"><b>{euros(o.total_cents)}</b></td></tr>
            {!!o.refunded_cents && <tr><td colSpan={2}>{t("Remboursé")}</td><td className="right num">− {euros(o.refunded_cents)}</td></tr>}</tfoot>
        </table>
        <p className="small">{t("Moyen de paiement")} : {o.payment_method ? t(METHOD[o.payment_method] || o.payment_method) : "—"} · {t("État")} : <b className={"status-" + o.status}>{t(STATUS[o.status])}</b></p>
        <p className="small muted">{t("Ce reçu atteste du paiement. Il ne constitue pas un reçu fiscal.")}</p>
        <div className="row-end no-print">
          {o.receipt_url && <a className="btn ghost" href={o.receipt_url} target="_blank" rel="noreferrer">{t("Reçu Stripe")}</a>}
          {canFiscal && <a className="btn ghost" href={"#/recu?id=" + encodeURIComponent(o.id) + "&fiscal=1"}>{t("Reçu fiscal")}</a>}
          <button className="btn" onClick={() => window.print()}>{t("Imprimer ou enregistrer en PDF")}</button>
        </div>
      </article>
    </div>
  );
}
