import { useEffect, useState } from "react";
import { annualReceipt, getAssociation, listOrders, type Association, type Order } from "../lib/backend";
import { useAuth } from "../lib/auth";
import { t } from "../lib/i18n";
import RecuFiscal from "./RecuFiscal";

/* Reçu fiscal annuel : tous les dons payés d'une année civile, sur un seul reçu. */
export default function RecuAnnuel({ params }: { params: URLSearchParams }) {
  const year = Number(params.get("annee"));
  const { profile } = useAuth();
  const [asso, setAsso] = useState<Association | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => { getAssociation().then(setAsso, () => {}); listOrders().then(setOrders, () => setOrders([])); }, []);
  if (!profile || !asso || !orders) return <div className="page narrow"><div className="card muted">{t("Chargement…")}</div></div>;
  const dons = orders.filter((o) => o.kind === "donation" && o.status === "paid" && new Date(o.created_at).getFullYear() === year).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const total = dons.reduce((s, o) => s + o.total_cents - (o.refunded_cents || 0), 0);
  const addressOk = !!(profile.address && profile.postal_code && profile.city && profile.last_name);
  return (
    <div className="page narrow">
      <nav className="crumbs no-print"><a href="#/compte">{t("‹ Mon compte")}</a></nav>
      <article className="card receipt">
        {!asso.tax_receipts || asso.receipt_mode !== "annual" || !total ? <p>{t("Reçu introuvable.")}</p>
          : !addressOk ? <p>{t("Pour le reçu fiscal, ajoutez votre adresse dans Mon compte.")} <a className="gold" href="#/compte">{t("‹ Mon compte")}</a></p>
          : <RecuFiscal asso={asso} donor={profile} input={{ key: "y" + year, amount_cents: total, year,
              lines: dons.map((o) => ({ date: o.created_at, amount_cents: o.total_cents - (o.refunded_cents || 0), label: o.label })),
              number: () => annualReceipt(year).then((r) => r.receipt_no) }} />}
        {addressOk && total > 0 && <div className="row-end no-print"><button className="btn" onClick={() => window.print()}>{t("Imprimer ou enregistrer en PDF")}</button></div>}
      </article>
    </div>
  );
}
