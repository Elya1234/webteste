import { cart } from "../lib/cart";
import { loc, t } from "../lib/i18n";
import { useEffect, useState } from "react";
import { LangSwitch } from "../components-lang";
import { demoCancelSubscription, listMySubscriptions, METHOD, openPaymentPortal, type Subscription, deleteAccount, DEMO, euros, listOrders, resetPassword, signIn, signOut, signUp, unreadCount, updateProfile, type Order, type Profile } from "../lib/backend";
import { useAuth } from "../lib/auth";
import { PasswordField, PhoneField } from "../components-forms";
import { checkPassword, countryOf, localPart, normalizePhone, type Country } from "../lib/validate";
import { go, type Route } from "../lib/router";

export const STATUS: Record<Order["status"], string> = { pending: "En attente", processing: "Prélèvement en cours", paid: "Payé", failed: "Échoué", cancelled: "Annulé", refunded: "Remboursé" };

function AuthForm({ after }: { after: Route | null }) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [f, setF] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [phone, setPhone] = useState<{ country: Country; raw: string }>({ country: "FR", raw: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const e164 = phone.raw.trim() ? normalizePhone(phone.country, phone.raw) : "";
    if (mode === "up") {
      if (e164 === null) { setMsg(t("Vérifiez le numéro de téléphone.")); return; }
      if (!checkPassword(f.password, [f.email, f.first_name, f.last_name]).ok) { setMsg(t("Le mot de passe ne respecte pas les règles ci-dessous.")); return; }
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const r = await signUp(f.email.trim(), f.password, { first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: e164 || "" });
        if (r.needsConfirmation) { setMsg(t("Compte créé. Ouvrez l'e-mail reçu pour le confirmer, puis connectez-vous.")); setMode("in"); setBusy(false); return; }
      } else await signIn(f.email.trim(), f.password);
      await refresh();
      if (after) go(after);
    } catch (err) {
      const m = String(err);
      setMsg(/Invalid login/i.test(m) ? t("E-mail ou mot de passe incorrect.") : /registered/i.test(m) ? t("Un compte existe déjà avec cet e-mail : connectez-vous.")
        : /too_many|rate limit/i.test(m) ? t("Trop d'essais. Réessayez dans quelques minutes.") : /not confirmed/i.test(m) ? t("Confirmez votre adresse e-mail avant de vous connecter.")
        : /weak_password|weak|Password should/i.test(m) ? t("Le mot de passe ne respecte pas les règles ci-dessous.") : /bad_phone/.test(m) ? t("Vérifiez le numéro de téléphone.") : t("Une erreur est survenue. Réessayez."));
    }
    setBusy(false);
  }
  async function forgot() {
    if (!f.email) { setMsg(t("Écrivez d'abord votre e-mail.")); return; }
    await resetPassword(f.email.trim()).catch(() => {});
    setMsg(t("Si un compte existe, un e-mail pour changer le mot de passe vient d'être envoyé."));
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="seg">
        <button type="button" className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>{t("Créer un compte")}</button>
        <button type="button" className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>{t("Se connecter")}</button>
      </div>
      {after && <p className="small muted">{t("Connectez-vous pour continuer vers le paiement.")}</p>}
      {mode === "up" && (
        <div className="grid-2 tight">
          <label className="field"><span>{t("Prénom")}</span><input className="input" required autoComplete="given-name" maxLength={60} value={f.first_name} onChange={set("first_name")} /></label>
          <label className="field"><span>{t("Nom")}</span><input className="input" required autoComplete="family-name" maxLength={60} value={f.last_name} onChange={set("last_name")} /></label>
        </div>
      )}
      <label className="field"><span>{t("E-mail")}</span><input className="input" type="email" required autoComplete="email" maxLength={254} value={f.email} onChange={set("email")} /></label>
      {mode === "up" && <PhoneField id="signup-phone" value={phone} onChange={(v) => { setPhone(v); setMsg(""); }} />}
      <PasswordField id={mode === "up" ? "signup-password" : "signin-password"} value={f.password} onChange={(v) => { setF({ ...f, password: v }); setMsg(""); }} isNew={mode === "up"} personal={[f.email, f.first_name, f.last_name]} />
      {msg && <p className="small">{msg}</p>}
      <button className="btn full" disabled={busy}>{busy ? "…" : mode === "up" ? t("Créer mon compte") : t("Se connecter")}</button>
      {mode === "in" && <button type="button" className="link" onClick={forgot}>{t("Mot de passe oublié ?")}</button>}
      {DEMO && <p className="small muted">{t("Mode démonstration : le compte reste sur cet appareil.")}</p>}
      <p className="small muted">{t("Une fois connecté, vous le restez sur cet appareil jusqu'à ce que vous vous déconnectiez.")}</p>
    </form>
  );
}

function Account({ profile }: { profile: Profile }) {
  const { refresh } = useAuth();
  const [p, setP] = useState(profile);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [saved, setSaved] = useState(false);
  const [pErr, setPErr] = useState("");
  const [phone, setPhone] = useState<{ country: Country; raw: string }>(() => ({ country: countryOf(profile.phone || ""), raw: profile.phone ? localPart(profile.phone) : "" }));
  useEffect(() => {
    // au retour du paiement (navigateur → appli), la liste se met à jour
    const load = () => listOrders().then(setOrders, () => setOrders([]));
    load();
    const f = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => { setP({ ...p, [k]: e.target.value }); setSaved(false); };

  return (
    <>
      <form className="card" onSubmit={(e) => {
        e.preventDefault(); setPErr("");
        const e164 = phone.raw.trim() ? normalizePhone(phone.country, phone.raw) : "";
        if (e164 === null) { setPErr(t("Vérifiez le numéro de téléphone.")); return; }
        updateProfile({ ...p, first_name: p.first_name.trim(), last_name: p.last_name.trim(), phone: e164 }).then(() => { setSaved(true); refresh(); }, () => setPErr(t("Une erreur est survenue. Réessayez.")));
      }}>
        <h2 className="serif gold-text">{t("Mon compte")}</h2>
        <div className="small muted">{p.email}</div>
        <div className="grid-2 tight">
          <label className="field"><span>{t("Prénom")}</span><input className="input" required maxLength={60} value={p.first_name} onChange={set("first_name")} /></label>
          <label className="field"><span>{t("Nom")}</span><input className="input" required maxLength={60} value={p.last_name} onChange={set("last_name")} /></label>
        </div>
        <PhoneField id="profile-phone" value={phone} onChange={(v) => { setPhone(v); setSaved(false); }} />
        {pErr && <p className="error small">{pErr}</p>}
        <div className="row-end">{saved && <span className="small gold">{t("Enregistré")}</span>}<button className="btn">{t("Enregistrer")}</button></div>
      </form>
      <Inbox />
      <MonthlyGifts />
      <section className="card">
        <h2 className="serif gold-text">{t("Mes commandes et dons")}</h2>
        {!orders ? <div className="muted">{t("Chargement…")}</div> : !orders.length ? <div className="muted">{t("Rien pour le moment.")}</div> : (
          <ul className="orders">{orders.map((o) => (
            <li key={o.id}><div><b>{o.kind === "donation" ? t("Don · ") : t("Boutique · ")}{o.label}</b><div className="small muted">{new Date(o.created_at).toLocaleDateString(loc())} · n° {o.id.slice(0, 8)}{o.payment_method && " · " + t(METHOD[o.payment_method] || o.payment_method)}</div>
              {(o.status === "paid" || o.status === "processing" || o.status === "refunded") && <a className="small gold" href={"#/recu?id=" + encodeURIComponent(o.id)}>{t("Reçu")} ›</a>}</div>
              <div className="right"><b className="num">{euros(o.total_cents)}</b><div className={"small status-" + o.status}>{t(STATUS[o.status])}</div>{!!o.refunded_cents && o.status !== "refunded" && <div className="small muted">{t("Remboursé")} {euros(o.refunded_cents)}</div>}</div></li>
          ))}</ul>
        )}
      </section>
      <div className="row-end">
        <button className="btn ghost" onClick={() => signOut().then(refresh)}>{t("Se déconnecter")}</button>
        <button className="btn ghost danger" onClick={() => { if (confirm("Supprimer définitivement votre compte ? Vos reçus déjà envoyés restent valables.")) deleteAccount().then(refresh); }}>{t("Supprimer mon compte")}</button>
      </div>
    </>
  );
}

function MonthlyGifts() {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { listMySubscriptions().then(setSubs, () => setSubs([])); }, []);
  const active = (subs || []).filter((x) => x.status !== "canceled");
  if (!active.length) return null;
  async function manage(id: string) {
    if (DEMO) { demoCancelSubscription(id); setSubs(await listMySubscriptions()); return; }
    setBusy(true);
    try { const url = await openPaymentPortal(); if (url) window.location.href = url; } finally { setBusy(false); }
  }
  return (
    <section className="card">
      <h2 className="serif gold-text">{t("Mes dons mensuels")}</h2>
      <ul className="orders">{active.map((x) => (
        <li key={x.id}><div><b>{t(x.purpose)}</b><div className="small muted">{euros(x.amount_cents)} {t("par mois")} · {t("depuis le {d}", { d: new Date(x.created_at).toLocaleDateString(loc()) })}</div></div>
          <button className="btn ghost" disabled={busy} onClick={() => manage(x.id)}>{DEMO ? t("Arrêter") : t("Gérer")}</button></li>
      ))}</ul>
      {!DEMO && <p className="small muted">{t("Gérer mes dons mensuels et cartes")} : Stripe.</p>}
    </section>
  );
}

function Inbox() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { unreadCount().then(setN, () => setN(0)); }, []);
  return (
    <a className="card msg-card" href="#/messages">
      <span className="tile-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11H8l-4 4z" /></svg></span>
      <span className="msg-card-t"><b>{t("Messages")}</b><span className="small muted">{t("Écrire à l'administration, rappels, annonces")}</span></span>
      {n ? <span className="badge-inline">{n} nouveau{n > 1 ? "x" : ""}</span> : <span className="gold" aria-hidden="true">›</span>}
    </a>
  );
}

export default function Compte({ params }: { params: URLSearchParams }) {
  const { profile, loading } = useAuth();
  const suite = params.get("suite") as Route | null;
  const paid = params.get("paiement");
  // retour de Stripe après un achat payé : le panier est vidé
  useEffect(() => { if (paid === "ok" || paid === "sepa") cart.clear(); }, [paid]);
  return (
    <div className="page narrow stack">
      {paid === "ok" && <div className="card ok">{t("Merci ! Votre paiement est bien enregistré. Tizkou lemitsvot.")}</div>}
      {paid === "annule" && <div className="card">{t("Paiement annulé : rien n'a été prélevé.")}</div>}
      {paid === "sepa" && <div className="card ok">{t("Merci ! Le prélèvement est en cours : il sera confirmé par la banque d'ici quelques jours.")}</div>}
      {loading ? <div className="card muted">{t("Chargement…")}</div> : profile ? <Account profile={profile} /> : <AuthForm after={suite} />}
      <LangSwitch />
      <a className="admin-link small" href="#/admin">{t("Espace administrateur")}</a>
    </div>
  );
}
