import { useEffect, useMemo, useState } from "react";
import { DEMO, euros } from "../lib/backend";
import { cancelSubscription, listSubscriptions, refundOrder, adminLogin, adminLogout, getThread, isAdmin, listAllOrders, listMembers, listSent, listThreads, replyTo, saveMember, sendMessage, toCsv,
  type AdminOrder, type Member, type Outgoing, type SentMessage, type Thread } from "../lib/admin";
import { METHOD, type ChatMessage, type Subscription } from "../lib/backend";
import { ChatThread } from "./Messages";
import AdminContenus from "./AdminContenus";
import { formatPhone } from "../lib/validate";
import { PURPOSES } from "./Dons";
import { go } from "../lib/router";

/* Espace administrateur : tableau de bord, membres (balises, historique), dons et achats, messages. */
type Tab = "tableau" | "membres" | "dons" | "messages" | "contenus";
const TABS: [Tab, string][] = [["tableau", "Tableau de bord"], ["membres", "Membres"], ["dons", "Paiements"], ["messages", "Messages"], ["contenus", "Contenus"]];
const fullName = (m?: Member) => (m ? [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email : "Compte supprimé");
const REMINDER_TEXT = "Bonjour, petit rappel amical : votre cotisation annuelle n'a pas encore été réglée. Vous pouvez la payer directement dans l'application avec le bouton ci-dessous. Merci pour votre soutien !";
const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Admin({ params }: { params: URLSearchParams }) {
  const [logged, setLogged] = useState(isAdmin);
  if (!logged) return <Login onOk={() => setLogged(true)} />;
  return <Dashboard tab={(params.get("tab") as Tab) || "tableau"} onLogout={() => { adminLogout(); setLogged(false); }} />;
}

function Login({ onOk }: { onOk: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await adminLogin(code.trim()); onOk(); } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  return (
    <div className="page narrow">
      <form className="card admin-login" onSubmit={submit}>
        <span className="tile-ic" aria-hidden="true">✡</span>
        <h1 className="serif gold-text">Administration</h1>
        <p className="muted">Entrez le code de l'administration (le même que pour l'écran de la synagogue).</p>
        <label className="field"><span>Code</span>
          <input id="admin-code" className="input code-input" type="password" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn full" disabled={busy || !code}>{busy ? "Vérification…" : "Entrer"}</button>
        {DEMO && <p className="small muted">Démonstration : vérification du code par la base de l'écran.</p>}
      </form>
    </div>
  );
}

function Dashboard({ tab, onLogout }: { tab: Tab; onLogout: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [err, setErr] = useState("");
  const [compose, setCompose] = useState<Outgoing | null>(null);
  const [open, setOpen] = useState<Member | null>(null);
  const reload = () => Promise.all([listMembers(), listAllOrders()]).then(([m, o]) => { setMembers(m); setOrders(o); })
    .catch((e) => { setErr(e.message); if (!isAdmin()) onLogout(); });
  useEffect(() => { reload(); const id = setInterval(reload, 60000); return () => clearInterval(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // paiements arrivés depuis la dernière visite de l'administration (sur cet appareil)
  const [seen, setSeen] = useState(() => { try { return localStorage.getItem("app.admin.seen") || new Date(Date.now() - 30 * 86400000).toISOString(); } catch { return new Date().toISOString(); } });
  const fresh = (orders || []).filter((o) => (o.status === "paid" || o.status === "processing") && o.created_at > seen);
  const markSeen = () => { const n = new Date().toISOString(); try { localStorage.setItem("app.admin.seen", n); } catch { /* mode privé */ } setSeen(n); };
  const byId = useMemo(() => new Map((members || []).map((m) => [m.id, m])), [members]);
  const allTags = useMemo(() => Array.from(new Set((members || []).flatMap((m) => m.tags))).sort((a, b) => a.localeCompare(b, "fr")), [members]);
  const [thread, setThread] = useState<string | null>(null);
  const write = (msg: Outgoing) => { setCompose(msg); setThread(null); go("admin", "tab=messages"); };
  const openThread = (id: string) => { setThread(id); go("admin", "tab=messages"); };
  const remind = (ids: string[]) => write({ title: "Cotisation annuelle", body: REMINDER_TEXT, to: "users", user_ids: ids, kind: "reminder", amount_cents: 36000, purpose: "Cotisation annuelle" });

  return (
    <div className="page admin">
      <header className="admin-head">
        <div className="page-head"><h1 className="serif gold-text">Administration</h1><span className="muted small">{DEMO ? "Démonstration : seules vos propres actions apparaissent" : "Connecté pour 12 heures"}</span></div>
        <button className="btn ghost" onClick={onLogout}>Se déconnecter</button>
      </header>
      <nav className="admin-tabs" role="tablist">
        {TABS.map(([id, label]) => <a key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} href={"#/admin?tab=" + id}>{label}{id === "dons" && fresh.length > 0 && <span className="badge-inline tab-badge">{fresh.length}</span>}</a>)}
      </nav>
      {err && <div className="card error">{err}</div>}
      {!members || !orders ? <div className="card muted">Chargement…</div> : (
        <>
          {tab === "tableau" && fresh.length > 0 && (
            <section className="card notif">
              <div className="card-head"><h2 className="serif gold-text">{fresh.length} nouveau{fresh.length > 1 ? "x" : ""} paiement{fresh.length > 1 ? "s" : ""}</h2><button className="btn ghost" onClick={markSeen}>Marquer comme vus</button></div>
              <OrderList orders={fresh} byId={byId} />
            </section>
          )}
          {tab === "tableau" && <Overview members={members} orders={orders} byId={byId} allTags={allTags} />}
          {tab === "membres" && <Members members={members} allTags={allTags} onOpen={setOpen} onWrite={write} onRemind={remind} />}
          {tab === "contenus" && <AdminContenus />}
          {tab === "dons" && <Orders orders={orders} byId={byId} onChanged={reload} />}
          {tab === "messages" && <Messages members={members} byId={byId} allTags={allTags} draft={compose} clearDraft={() => setCompose(null)} thread={thread} setThread={setThread} />}
        </>
      )}
      {open && <MemberSheet member={open} allTags={allTags} orders={(orders || []).filter((o) => o.user_id === open.id)} onClose={() => setOpen(null)}
        onSaved={() => { setOpen(null); reload(); }} onWrite={(m) => { setOpen(null); openThread(m.id); }} onRemind={(m) => { setOpen(null); remind([m.id]); }} />}
    </div>
  );
}

function UnreadBanner() {
  const [n, setN] = useState(0);
  useEffect(() => { listThreads().then((t) => setN(t.reduce((s, x) => s + x.unread, 0)), () => {}); }, []);
  return n ? <a className="card unread-banner" href="#/admin?tab=messages"><b>{n} message{n > 1 ? "s" : ""} non lu{n > 1 ? "s" : ""}</b><span className="gold">Répondre ›</span></a> : null;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="card stat"><span className="small muted">{label}</span><b className="num gold-text">{value}</b>{sub && <span className="small muted">{sub}</span>}</div>;
}

function Overview({ members, orders, byId, allTags }: { members: Member[]; orders: AdminOrder[]; byId: Map<string, Member>; allTags: string[] }) {
  const paid = orders.filter((o) => o.status === "paid");
  const month = new Date().toISOString().slice(0, 7);
  const dons = paid.filter((o) => o.kind === "donation");
  const sum = (l: AdminOrder[]) => l.reduce((s, o) => s + o.total_cents, 0);
  const newMembers = members.filter((m) => Date.now() - +new Date(m.created_at) < 30 * 86400000).length;
  return (
    <>
      <div className="stats">
        <Stat label="Membres inscrits" value={String(members.length)} sub={newMembers + " nouveau(x) en 30 jours"} />
        <Stat label="Dons ce mois-ci" value={euros(sum(dons.filter((o) => o.created_at.startsWith(month))))} sub={dons.filter((o) => o.created_at.startsWith(month)).length + " don(s)"} />
        <Stat label="Total des dons" value={euros(sum(dons))} sub={dons.length + " don(s)"} />
        <Stat label="Boutique" value={euros(sum(paid.filter((o) => o.kind === "shop")))} sub={paid.filter((o) => o.kind === "shop").length + " commande(s)"} />
      </div>
      <UnreadBanner />
      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2 className="serif gold-text">Dernières activités</h2><a href="#/admin?tab=dons">Tout voir ›</a></div>
          <ul className="admin-list">
            {paid.slice(0, 6).map((o) => (
              <li key={o.id}><div><b>{fullName(byId.get(o.user_id || ""))}</b><div className="small muted">{o.kind === "donation" ? "Don · " : "Boutique · "}{o.label} · {dateFr(o.created_at)}</div></div><b className="num">{euros(o.total_cents)}</b></li>
            ))}
            {!paid.length && <li className="muted">Aucun paiement pour le moment.</li>}
          </ul>
        </section>
        <section className="card">
          <div className="card-head"><h2 className="serif gold-text">Groupes (balises)</h2><a href="#/admin?tab=membres">Membres ›</a></div>
          <div className="chips">
            {allTags.map((t) => <span key={t} className="chip static">{t} · {members.filter((m) => m.tags.includes(t)).length}</span>)}
            <span className="chip static">Sans balise · {members.filter((m) => !m.tags.length).length}</span>
          </div>
          <p className="small muted">Les balises servent à envoyer un message à un groupe (cotisants, conseil, femmes, jeunes…).</p>
        </section>
      </div>
    </>
  );
}

function Members({ members, allTags, onOpen, onWrite, onRemind }: { members: Member[]; allTags: string[]; onOpen: (m: Member) => void; onWrite: (m: Outgoing) => void; onRemind: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const shown = members.filter((m) => (!tag || (tag === "-" ? !m.tags.length : m.tags.includes(tag))) &&
    (!q || norm([m.first_name, m.last_name, m.email, m.phone, ...m.tags].join(" ")).includes(norm(q))))
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "fr"));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const exportCsv = () => download("membres.csv", toCsv([["Prénom", "Nom", "E-mail", "Téléphone", "Balises", "Inscrit le", "Total dons (€)", "Boutique (€)"],
    ...shown.map((m) => [m.first_name, m.last_name, m.email, m.phone, m.tags.join(", "), dateFr(m.created_at), (m.donated_cents / 100).toFixed(2), (m.spent_cents / 100).toFixed(2)])]));
  return (
    <section className="card">
      <div className="admin-tools">
        <input id="member-search" className="input" type="search" placeholder="Rechercher un nom, un e-mail, un téléphone" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={"chip" + (!tag ? " on" : "")} onClick={() => setTag("")}>Tous · {members.length}</button>
          {allTags.map((t) => <button key={t} className={"chip" + (tag === t ? " on" : "")} onClick={() => setTag(t)}>{t}</button>)}
          <button className={"chip" + (tag === "-" ? " on" : "")} onClick={() => setTag("-")}>Sans balise</button>
        </div>
        <div className="row-end">
          <button className="btn ghost" onClick={exportCsv}>Exporter (Excel)</button>
          <button className="btn ghost" disabled={!sel.size} onClick={() => onRemind([...sel])}>Rappel de paiement</button>
          <button className="btn" disabled={!sel.size} onClick={() => onWrite({ title: "", body: "", to: "users", user_ids: [...sel] })}>Écrire aux {sel.size || ""} sélectionné(s)</button>
        </div>
      </div>
      <ul className="member-list">
        {shown.map((m) => (
          <li key={m.id}>
            <input type="checkbox" aria-label={"Sélectionner " + fullName(m)} checked={sel.has(m.id)} onChange={() => toggle(m.id)} />
            <button className="member-row" onClick={() => onOpen(m)}>
              <span className="avatar" aria-hidden="true">{(m.first_name[0] || m.email[0] || "?").toUpperCase()}</span>
              <span className="member-main"><b>{fullName(m)}</b><span className="small muted">{m.email}{m.phone && " · " + formatPhone(m.phone)}</span>
                {m.tags.length > 0 && <span className="tag-row">{m.tags.map((t) => <span key={t} className="tag">{t}</span>)}</span>}</span>
              <span className="member-sum"><b className="num">{euros(m.donated_cents)}</b><span className="small muted">{m.last_at ? "dernier " + dateFr(m.last_at) : "aucun don"}</span></span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="muted">Aucun membre trouvé.</li>}
      </ul>
    </section>
  );
}

function MemberSheet({ member, allTags, orders, onClose, onSaved, onWrite, onRemind }:
  { member: Member; allTags: string[]; orders: AdminOrder[]; onClose: () => void; onSaved: () => void; onWrite: (m: Member) => void; onRemind: (m: Member) => void }) {
  const [tags, setTags] = useState(member.tags);
  const [note, setNote] = useState(member.note);
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const addTag = (t: string) => { const v = t.trim(); if (v && !tags.includes(v)) setTags([...tags, v]); setAdd(""); };
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet card member-sheet" role="dialog" aria-label={fullName(member)} onClick={(e) => e.stopPropagation()}>
        <div className="card-head"><h2 className="serif gold-text">{fullName(member)}</h2><button className="btn ghost sm" aria-label="Fermer" onClick={onClose}>✕</button></div>
        <div className="small muted">{member.email}{member.phone && " · " + formatPhone(member.phone)} · inscrit le {dateFr(member.created_at)}</div>
        <div className="stats two">
          <Stat label="Total des dons" value={euros(member.donated_cents)} />
          <Stat label="Boutique" value={euros(member.spent_cents)} />
        </div>
        <div className="field"><span>Balises</span>
          <div className="chips">
            {tags.map((t) => <button key={t} className="chip on" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={"Retirer " + t}>{t} ✕</button>)}
            {allTags.filter((t) => !tags.includes(t)).map((t) => <button key={t} className="chip" onClick={() => addTag(t)}>+ {t}</button>)}
          </div>
          <form className="tag-add" onSubmit={(e) => { e.preventDefault(); addTag(add); }}>
            <input id="tag-new" className="input" placeholder="Nouvelle balise (ex. Cotisant 2027)" value={add} onChange={(e) => setAdd(e.target.value)} maxLength={30} />
            <button className="btn ghost" disabled={!add.trim()}>Ajouter</button>
          </form>
        </div>
        <label className="field"><span>Note (visible seulement par l'administration)</span>
          <textarea id="member-note" className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
        </label>
        <div className="row-end">
          <button className="btn ghost" onClick={() => onRemind(member)}>Rappel de paiement</button>
          <button className="btn ghost" onClick={() => onWrite(member)}>Conversation</button>
          <button className="btn" disabled={busy} onClick={() => { setBusy(true); saveMember(member.id, tags, note).then(onSaved, () => setBusy(false)); }}>{busy ? "…" : "Enregistrer"}</button>
        </div>
        <h3 className="serif">Historique</h3>
        <OrderList orders={orders} />
      </div>
    </div>
  );
}

const STATUS_FR: Record<string, string> = { pending: "En attente", processing: "Prélèvement en cours", paid: "Payé", failed: "Échoué", cancelled: "Annulé", refunded: "Remboursé" };

function OrderList({ orders, byId, onPick }: { orders: AdminOrder[]; byId?: Map<string, Member>; onPick?: (o: AdminOrder) => void }) {
  if (!orders.length) return <p className="muted">Aucun don ni achat.</p>;
  return (
    <ul className="admin-list">
      {orders.map((o) => (
        <li key={o.id} className={onPick ? "pickable" : ""} onClick={onPick ? () => onPick(o) : undefined}>
          <div>
            <b>{byId ? fullName(byId.get(o.user_id || "")) + " · " : ""}{o.kind === "donation" ? "Don" : "Boutique"} · {o.label}</b>
            <div className="small muted">{dateFr(o.created_at)}{o.payment_method && " · " + (METHOD[o.payment_method] || o.payment_method)}{o.stripe_subscription_id && " · mensuel"}</div>
            {o.dedication && <div className="small">Dédicace : « {o.dedication} »</div>}
            {o.order_items?.map((it, i) => <div key={i} className="small">{it.qty} × {it.name} (réf. {it.ref}){it.comment && " · « " + it.comment + " »"}</div>)}
          </div>
          <div className="right"><b className="num">{euros(o.total_cents)}</b><div className={"small status-" + o.status}>{STATUS_FR[o.status] || o.status}</div>
            {!!o.refunded_cents && o.status !== "refunded" && <div className="small muted">remb. {euros(o.refunded_cents)}</div>}</div>
        </li>
      ))}
    </ul>
  );
}

function PaymentSheet({ order, member, onClose, onDone }: { order: AdminOrder; member?: Member; onClose: () => void; onDone: () => void }) {
  const left = order.total_cents - (order.refunded_cents || 0);
  const [amount, setAmount] = useState((left / 100).toFixed(2).replace(".", ","));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cents = Math.round(Number(amount.replace(",", ".")) * 100);
  async function refund() {
    setBusy(true); setErr("");
    try { await refundOrder(order.id, cents); onDone(); } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet card member-sheet" role="dialog" aria-label="Paiement" onClick={(e) => e.stopPropagation()}>
        <div className="card-head"><h2 className="serif gold-text">{euros(order.total_cents)}</h2><button className="btn ghost sm" aria-label="Fermer" onClick={onClose}>✕</button></div>
        <dl className="kv">
          <dt>Membre</dt><dd>{fullName(member)}{member?.email && " · " + member.email}</dd>
          <dt>Objet</dt><dd>{order.kind === "donation" ? "Don" : "Boutique"} · {order.label}</dd>
          {order.dedication && <><dt>Dédicace</dt><dd>{order.dedication}</dd></>}
          <dt>Date</dt><dd>{new Date(order.created_at).toLocaleString("fr-FR")}</dd>
          <dt>Moyen</dt><dd>{order.payment_method ? METHOD[order.payment_method] || order.payment_method : "—"}</dd>
          <dt>État</dt><dd className={"status-" + order.status}>{STATUS_FR[order.status]}{order.refunded_cents ? " · remboursé " + euros(order.refunded_cents) : ""}</dd>
          <dt>N°</dt><dd className="num">{order.id}</dd>
        </dl>
        {order.receipt_url && <a className="btn ghost" href={order.receipt_url} target="_blank" rel="noreferrer">Voir le reçu Stripe</a>}
        {order.status === "paid" && left > 0 && (
          <div className="refund">
            <h3 className="serif">Rembourser</h3>
            <div className="tag-add">
              <input id="refund-amount" className="input num" inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^\d,.]/g, "")); setConfirm(false); }} aria-label="Montant à rembourser (€)" />
              {!confirm
                ? <button className="btn ghost" disabled={!(cents > 0 && cents <= left)} onClick={() => setConfirm(true)}>Rembourser</button>
                : <button className="btn danger-solid" disabled={busy} onClick={refund}>{busy ? "…" : "Confirmer " + euros(cents)}</button>}
            </div>
            <p className="small muted">{confirm ? "Le membre est remboursé sur son moyen de paiement (5 à 10 jours). Cette action est définitive." : "Remboursement total ou partiel (jusqu'à " + euros(left) + ")."}</p>
          </div>
        )}
        {err && <p className="error">{err}</p>}
      </div>
    </div>
  );
}

function Orders({ orders, byId, onChanged }: { orders: AdminOrder[]; byId: Map<string, Member>; onChanged: () => void }) {
  const [kind, setKind] = useState<"" | "donation" | "shop" | "mensuel">("");
  const [status, setStatus] = useState("");
  const [pick, setPick] = useState<AdminOrder | null>(null);
  const shown = orders.filter((o) => (!kind || (kind === "mensuel" ? !!o.stripe_subscription_id : o.kind === kind)) && (!status || o.status === status));
  const total = shown.filter((o) => o.status === "paid").reduce((s, o) => s + o.total_cents - (o.refunded_cents || 0), 0);
  const exportCsv = () => download("dons-et-achats.csv", toCsv([["Date", "Membre", "E-mail", "Type", "Motif", "Dédicace / commentaire", "Montant (€)", "Remboursé (€)", "Moyen", "État", "N°"],
    ...shown.map((o) => { const m = byId.get(o.user_id || ""); return [dateFr(o.created_at), fullName(m), m?.email || "", o.kind === "donation" ? "Don" : "Boutique", o.label,
      o.dedication || (o.order_items || []).map((i) => i.comment).filter(Boolean).join(" / "), (o.total_cents / 100).toFixed(2), ((o.refunded_cents || 0) / 100).toFixed(2),
      o.payment_method ? METHOD[o.payment_method] || o.payment_method : "", STATUS_FR[o.status] || o.status, o.id]; })]));
  return (
    <>
      <Subscriptions byId={byId} />
      <section className="card">
        <h2 className="serif gold-text">Tous les paiements</h2>
        <div className="admin-tools">
          <div className="chips">
            {([["", "Tout"], ["donation", "Dons"], ["mensuel", "Dons mensuels"], ["shop", "Boutique"]] as const).map(([k, l]) => <button key={k} className={"chip" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <div className="chips">
            {[["", "Tous états"], ["paid", "Payés"], ["processing", "Prélèvement en cours"], ["pending", "En attente"], ["failed", "Échoués"], ["refunded", "Remboursés"], ["cancelled", "Annulés"]].map(([k, l]) =>
              <button key={k} className={"chip" + (status === k ? " on" : "")} onClick={() => setStatus(k)}>{l} · {orders.filter((o) => !k || o.status === k).length}</button>)}
          </div>
          <div className="row-end"><span className="muted">Total encaissé : <b className="gold-text num">{euros(total)}</b></span><button className="btn ghost" onClick={exportCsv}>Exporter (Excel)</button></div>
        </div>
        <OrderList orders={shown} byId={byId} onPick={setPick} />
      </section>
      {pick && <PaymentSheet order={pick} member={byId.get(pick.user_id || "")} onClose={() => setPick(null)} onDone={() => { setPick(null); onChanged(); }} />}
    </>
  );
}

function Subscriptions({ byId }: { byId: Map<string, Member> }) {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [ask, setAsk] = useState<string | null>(null);
  const load = () => listSubscriptions().then(setSubs, () => setSubs([]));
  useEffect(() => { load(); }, []);
  const active = (subs || []).filter((x) => x.status !== "canceled");
  if (!subs) return null;
  return (
    <section className="card">
      <div className="card-head"><h2 className="serif gold-text">Dons mensuels</h2><span className="muted">{active.length} actif(s) · <b className="gold-text num">{euros(active.reduce((s, x) => s + x.amount_cents, 0))}</b> / mois</span></div>
      {!subs.length ? <p className="muted">Aucun don mensuel pour le moment.</p> : (
        <ul className="admin-list">{subs.map((x) => (
          <li key={x.id}><div><b>{fullName(byId.get(x.user_id || ""))} · {x.purpose}</b><div className="small muted">depuis le {dateFr(x.created_at)}{x.status === "canceled" ? " · arrêté" : x.status === "past_due" ? " · paiement en retard" : ""}</div></div>
            <div className="right"><b className="num">{euros(x.amount_cents)}</b><div className="small muted">/ mois</div>
              {x.status !== "canceled" && (ask === x.id
                ? <button className="btn danger-solid sm-text" onClick={() => cancelSubscription(x.id).then(() => { setAsk(null); load(); })}>Confirmer l'arrêt</button>
                : <button className="link small" onClick={() => setAsk(x.id)}>Arrêter</button>)}</div></li>
        ))}</ul>
      )}
    </section>
  );
}

function Messages({ members, byId, allTags, draft, clearDraft, thread, setThread }:
  { members: Member[]; byId: Map<string, Member>; allTags: string[]; draft: Outgoing | null; clearDraft: () => void; thread: string | null; setThread: (id: string | null) => void }) {
  const [view, setView] = useState<"conv" | "groupe">(draft ? "groupe" : "conv");
  useEffect(() => { if (draft) setView("groupe"); }, [draft]);
  useEffect(() => { if (thread) setView("conv"); }, [thread]);
  return (
    <>
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={view === "conv"} className={view === "conv" ? "on" : ""} onClick={() => setView("conv")}>Conversations</button>
        <button role="tab" aria-selected={view === "groupe"} className={view === "groupe" ? "on" : ""} onClick={() => setView("groupe")}>Envoi groupé et rappels</button>
      </div>
      {view === "conv" ? <Conversations members={members} byId={byId} open={thread} setOpen={setThread} /> : <Compose members={members} allTags={allTags} draft={draft} clearDraft={clearDraft} />}
    </>
  );
}

function Conversations({ members, byId, open, setOpen }: { members: Member[]; byId: Map<string, Member>; open: string | null; setOpen: (id: string | null) => void }) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [pick, setPick] = useState("");
  const loadThreads = () => listThreads().then(setThreads, () => setThreads([]));
  const loadMsgs = (id: string) => getThread(id).then(setMsgs, () => setMsgs([]));
  useEffect(() => { loadThreads(); const t = setInterval(loadThreads, 30000); return () => clearInterval(t); }, []);
  useEffect(() => { setMsgs(null); if (!open) return; loadMsgs(open); const t = setInterval(() => loadMsgs(open), 20000); return () => clearInterval(t); }, [open]);
  const others = members.filter((m) => !(threads || []).some((t) => t.user_id === m.id));
  const member = open ? byId.get(open) : undefined;
  return (
    <div className={"conv" + (open ? " has-open" : "")}>
      <section className="card conv-list">
        <h2 className="serif gold-text">Conversations</h2>
        {!threads ? <div className="muted">Chargement…</div> : (
          <ul className="admin-list">
            {threads.map((t) => (
              <li key={t.user_id} className={open === t.user_id ? "sel" : ""}><button className="conv-row" onClick={() => setOpen(t.user_id)}>
                <span className="avatar" aria-hidden="true">{(byId.get(t.user_id)?.first_name[0] || "?").toUpperCase()}</span>
                <span className="member-main"><b>{fullName(byId.get(t.user_id))}</b><span className="small muted conv-last">{t.last.from_admin ? "Vous : " : ""}{t.last.title || t.last.body}</span></span>
                {t.unread > 0 ? <span className="badge-inline">{t.unread}</span> : <span className="small muted">{dateFr(t.last.created_at)}</span>}
              </button></li>
            ))}
            {!threads.length && <li className="muted">Aucune conversation pour le moment.</li>}
          </ul>
        )}
        <div className="field"><span>Nouvelle conversation</span>
          <div className="tag-add">
            <select id="conv-new" className="input" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choisir un membre…</option>
              {others.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
            </select>
            <button className="btn ghost" disabled={!pick} onClick={() => { setOpen(pick); setPick(""); }}>Ouvrir</button>
          </div>
        </div>
      </section>
      <section className="card conv-thread">
        {!open ? <p className="muted">Choisissez une conversation pour lire et répondre.</p> : (
          <>
            <div className="card-head"><div><button className="link conv-back" onClick={() => setOpen(null)}>‹ Conversations</button><h2 className="serif gold-text">{fullName(member)}</h2>
              <div className="small muted">{member?.email}{member?.phone && " · " + formatPhone(member.phone)}</div></div></div>
            {!msgs ? <div className="muted">Chargement…</div> :
              <ChatThread messages={msgs} side="admin" onSend={async (t) => { await replyTo(open, t); await loadMsgs(open); loadThreads(); }} />}
          </>
        )}
      </section>
    </div>
  );
}

function Compose({ members, allTags, draft, clearDraft }: { members: Member[]; allTags: string[]; draft: Outgoing | null; clearDraft: () => void }) {
  const blank: Outgoing = { title: "", body: "", to: "all", tags: [], kind: "broadcast" };
  const [m, setM] = useState<Outgoing>(draft || blank);
  const [sent, setSent] = useState<SentMessage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [euro, setEuro] = useState(draft?.amount_cents ? String(draft.amount_cents / 100) : "360");
  useEffect(() => { if (draft) { setM(draft); if (draft.amount_cents) setEuro(String(draft.amount_cents / 100)); clearDraft(); } }, [draft, clearDraft]);
  useEffect(() => { listSent().then(setSent, () => setSent([])); }, []);
  const reminder = m.kind === "reminder";
  const count = m.to === "all" ? members.length : m.to === "tags" ? members.filter((x) => x.tags.some((t) => (m.tags || []).includes(t))).length : (m.user_ids || []).length;
  const chosen = members.filter((x) => (m.user_ids || []).includes(x.id));
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const n = await sendMessage({ ...m, amount_cents: reminder ? Math.round(Number(euro.replace(",", ".")) * 100) : undefined });
      setMsg((reminder ? "Rappel envoyé à " : "Message envoyé à ") + n + " membre(s)."); setM(blank); setSent(await listSent());
    } catch (x) { setMsg((x as Error).message); }
    setBusy(false);
  }
  return (
    <div className="grid-2">
      <form className="card" onSubmit={send}>
        <h2 className="serif gold-text">{reminder ? "Rappel de paiement" : "Message de groupe"}</h2>
        <div className="seg">
          <button type="button" className={!reminder ? "on" : ""} onClick={() => setM({ ...m, kind: "broadcast" })}>Message</button>
          <button type="button" className={reminder ? "on" : ""} onClick={() => setM({ ...m, kind: "reminder", title: m.title || "Cotisation annuelle", body: m.body || REMINDER_TEXT, purpose: m.purpose || "Cotisation annuelle" })}>Rappel de paiement</button>
        </div>
        <div className="field"><span>Destinataires</span>
          <div className="seg three">
            <button type="button" className={m.to === "all" ? "on" : ""} onClick={() => setM({ ...m, to: "all" })}>Tous</button>
            <button type="button" className={m.to === "tags" ? "on" : ""} onClick={() => setM({ ...m, to: "tags" })}>Par balise</button>
            <button type="button" className={m.to === "users" ? "on" : ""} onClick={() => setM({ ...m, to: "users" })}>Choisis</button>
          </div>
          {m.to === "tags" && <div className="chips">{allTags.map((t) => { const on = (m.tags || []).includes(t);
            return <button type="button" key={t} className={"chip" + (on ? " on" : "")} onClick={() => setM({ ...m, tags: on ? (m.tags || []).filter((x) => x !== t) : [...(m.tags || []), t] })}>{t}</button>; })}</div>}
          {m.to === "users" && <div className="chips">{chosen.length ? chosen.map((x) => <span key={x.id} className="chip static">{fullName(x)}</span>) : <span className="small muted">Cochez les membres dans l'onglet Membres.</span>}</div>}
          <span className="small muted">{count} destinataire(s)</span>
        </div>
        {reminder && (
          <div className="grid-2 tight">
            <label className="field"><span>Montant (€)</span><input id="rem-amount" className="input" inputMode="decimal" value={euro} onChange={(e) => setEuro(e.target.value.replace(/[^\d,.]/g, ""))} /></label>
            <label className="field"><span>Motif</span><select id="rem-purpose" className="input" value={m.purpose} onChange={(e) => setM({ ...m, purpose: e.target.value })}>{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></label>
          </div>
        )}
        <label className="field"><span>Titre</span><input id="msg-title" className="input" required maxLength={120} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} placeholder="Ex. Horaires de Hanoucca" /></label>
        <label className="field"><span>Message</span><textarea id="msg-body" className="input" required rows={5} maxLength={4000} value={m.body} onChange={(e) => setM({ ...m, body: e.target.value })} /></label>
        {msg && <p className="small gold">{msg}</p>}
        <button className="btn full" disabled={busy || !count}>{busy ? "Envoi…" : (reminder ? "Envoyer le rappel à " : "Envoyer à ") + count + " membre(s)"}</button>
        <p className="small muted">{reminder ? "Chaque membre reçoit le rappel dans sa conversation, avec un bouton « Payer » déjà rempli." : "Le message arrive dans la conversation de chaque membre (Compte › Messages)."}</p>
      </form>
      <section className="card">
        <h2 className="serif gold-text">Envois groupés</h2>
        {!sent ? <div className="muted">Chargement…</div> : !sent.length ? <div className="muted">Aucun envoi.</div> : (
          <ul className="admin-list">{sent.map((x) => (
            <li key={x.id}><div><b>{x.kind === "reminder" ? "Rappel · " : ""}{x.title}</b><div className="small muted">{dateFr(x.created_at)} · {x.target}</div><div className="small msg-body">{x.body}</div></div>
              <span className="small muted right">lu par<br /><b className="num">{x.read}/{x.sent}</b></span></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
