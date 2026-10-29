import { useEffect, useState } from "react";
import { deleteAccount, DEMO, euros, listInbox, listOrders, markRead, resetPassword, signIn, signOut, signUp, updateProfile, type InboxMessage, type Order, type Profile } from "../lib/backend";
import { useAuth } from "../lib/auth";
import { go, type Route } from "../lib/router";

const STATUS: Record<Order["status"], string> = { pending: "En attente", paid: "Payé", cancelled: "Annulé" };

function AuthForm({ after }: { after: Route | null }) {
  const { refresh } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [f, setF] = useState({ email: "", password: "", first_name: "", last_name: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      if (mode === "up") {
        const r = await signUp(f.email.trim(), f.password, { first_name: f.first_name.trim(), last_name: f.last_name.trim(), phone: f.phone.trim() });
        if (r.needsConfirmation) { setMsg("Compte créé. Ouvrez l'e-mail reçu pour le confirmer, puis connectez-vous."); setMode("in"); setBusy(false); return; }
      } else await signIn(f.email.trim(), f.password);
      await refresh();
      if (after) go(after);
    } catch (err) {
      setMsg(/Invalid login/i.test(String(err)) ? "E-mail ou mot de passe incorrect." : /registered/i.test(String(err)) ? "Un compte existe déjà avec cet e-mail : connectez-vous." : "Une erreur est survenue. Réessayez.");
    }
    setBusy(false);
  }
  async function forgot() {
    if (!f.email) { setMsg("Écrivez d'abord votre e-mail."); return; }
    await resetPassword(f.email.trim()).catch(() => {});
    setMsg("Si un compte existe, un e-mail pour changer le mot de passe vient d'être envoyé.");
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="seg">
        <button type="button" className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>Créer un compte</button>
        <button type="button" className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>Se connecter</button>
      </div>
      {after && <p className="small muted">Connectez-vous pour continuer vers le paiement.</p>}
      {mode === "up" && (
        <div className="grid-2 tight">
          <label className="field"><span>Prénom</span><input className="input" required autoComplete="given-name" value={f.first_name} onChange={set("first_name")} /></label>
          <label className="field"><span>Nom</span><input className="input" required autoComplete="family-name" value={f.last_name} onChange={set("last_name")} /></label>
        </div>
      )}
      <label className="field"><span>E-mail</span><input className="input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></label>
      {mode === "up" && <label className="field"><span>Téléphone (facultatif)</span><input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} /></label>}
      <label className="field"><span>Mot de passe</span><input className="input" type="password" required minLength={8} autoComplete={mode === "up" ? "new-password" : "current-password"} value={f.password} onChange={set("password")} /></label>
      {msg && <p className="small">{msg}</p>}
      <button className="btn full" disabled={busy}>{busy ? "…" : mode === "up" ? "Créer mon compte" : "Se connecter"}</button>
      {mode === "in" && <button type="button" className="link" onClick={forgot}>Mot de passe oublié ?</button>}
      {DEMO && <p className="small muted">Mode démonstration : le compte reste sur cet appareil.</p>}
    </form>
  );
}

function Account({ profile }: { profile: Profile }) {
  const { refresh } = useAuth();
  const [p, setP] = useState(profile);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [saved, setSaved] = useState(false);
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
      <form className="card" onSubmit={(e) => { e.preventDefault(); updateProfile(p).then(() => { setSaved(true); refresh(); }); }}>
        <h2 className="serif gold-text">Mon compte</h2>
        <div className="small muted">{p.email}</div>
        <div className="grid-2 tight">
          <label className="field"><span>Prénom</span><input className="input" value={p.first_name} onChange={set("first_name")} /></label>
          <label className="field"><span>Nom</span><input className="input" value={p.last_name} onChange={set("last_name")} /></label>
        </div>
        <label className="field"><span>Téléphone</span><input className="input" type="tel" value={p.phone} onChange={set("phone")} /></label>
        <div className="row-end">{saved && <span className="small gold">Enregistré</span>}<button className="btn">Enregistrer</button></div>
      </form>
      <Inbox />
      <section className="card">
        <h2 className="serif gold-text">Mes commandes et dons</h2>
        {!orders ? <div className="muted">Chargement…</div> : !orders.length ? <div className="muted">Rien pour le moment.</div> : (
          <ul className="orders">{orders.map((o) => (
            <li key={o.id}><div><b>{o.kind === "donation" ? "Don · " : "Boutique · "}{o.label}</b><div className="small muted">{new Date(o.created_at).toLocaleDateString("fr-FR")} · n° {o.id.slice(0, 8)}</div></div>
              <div className="right"><b className="num">{euros(o.total_cents)}</b><div className="small">{STATUS[o.status]}</div></div></li>
          ))}</ul>
        )}
      </section>
      <div className="row-end">
        <button className="btn ghost" onClick={() => signOut().then(refresh)}>Se déconnecter</button>
        <button className="btn ghost danger" onClick={() => { if (confirm("Supprimer définitivement votre compte ? Vos reçus déjà envoyés restent valables.")) deleteAccount().then(refresh); }}>Supprimer mon compte</button>
      </div>
    </>
  );
}

function Inbox() {
  const [msgs, setMsgs] = useState<InboxMessage[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { listInbox().then(setMsgs, () => setMsgs([])); }, []);
  const unread = (msgs || []).filter((m) => !m.read_at).length;
  function toggle(m: InboxMessage) {
    setOpen(open === m.id ? null : m.id);
    if (!m.read_at) { markRead(m.id); setMsgs((l) => (l || []).map((x) => (x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x))); }
  }
  return (
    <section className="card">
      <div className="card-head"><h2 className="serif gold-text">Messages</h2>{unread > 0 && <span className="badge-inline">{unread} nouveau(x)</span>}</div>
      {!msgs ? <div className="muted">Chargement…</div> : !msgs.length ? <div className="muted">Aucun message de la synagogue pour le moment.</div> : (
        <ul className="inbox">{msgs.map((m) => (
          <li key={m.id} className={m.read_at ? "" : "unread"}>
            <button onClick={() => toggle(m)} aria-expanded={open === m.id}><b>{m.title}</b><span className="small muted">{new Date(m.created_at).toLocaleDateString("fr-FR")}</span></button>
            {open === m.id && <p className="msg-body">{m.body}</p>}
          </li>
        ))}</ul>
      )}
    </section>
  );
}

export default function Compte({ params }: { params: URLSearchParams }) {
  const { profile, loading } = useAuth();
  const suite = params.get("suite") as Route | null;
  const paid = params.get("paiement");
  return (
    <div className="page narrow stack">
      {paid === "ok" && <div className="card ok">Merci ! Votre paiement est bien enregistré. Tizkou lemitsvot.</div>}
      {paid === "annule" && <div className="card">Paiement annulé : rien n'a été prélevé.</div>}
      {loading ? <div className="card muted">Chargement…</div> : profile ? <Account profile={profile} /> : <AuthForm after={suite} />}
      <a className="admin-link small" href="#/admin">Espace administrateur</a>
    </div>
  );
}
