import { useEffect, useMemo, useState } from "react";
import { DEMO, euros } from "../lib/backend";
import { adminLogin, adminLogout, isAdmin, listAllOrders, listMembers, listSent, saveMember, sendMessage, toCsv,
  type AdminOrder, type Member, type Outgoing, type SentMessage } from "../lib/admin";
import { go } from "../lib/router";

/* Espace administrateur : tableau de bord, membres (balises, historique), dons et achats, messages. */
type Tab = "tableau" | "membres" | "dons" | "messages";
const TABS: [Tab, string][] = [["tableau", "Tableau de bord"], ["membres", "Membres"], ["dons", "Dons et achats"], ["messages", "Messages"]];
const fullName = (m?: Member) => (m ? [m.first_name, m.last_name].filter(Boolean).join(" ") || m.email : "Compte supprimé");
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
        {DEMO && <p className="small muted">Démonstration : les membres et les dons affichés sont des exemples.</p>}
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
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map((members || []).map((m) => [m.id, m])), [members]);
  const allTags = useMemo(() => Array.from(new Set((members || []).flatMap((m) => m.tags))).sort((a, b) => a.localeCompare(b, "fr")), [members]);
  const write = (msg: Outgoing) => { setCompose(msg); go("admin", "tab=messages"); };

  return (
    <div className="page admin">
      <header className="admin-head">
        <div className="page-head"><h1 className="serif gold-text">Administration</h1><span className="muted small">{DEMO ? "Démonstration · données d'exemple" : "Connecté pour 12 heures"}</span></div>
        <button className="btn ghost" onClick={onLogout}>Se déconnecter</button>
      </header>
      <nav className="admin-tabs" role="tablist">
        {TABS.map(([id, label]) => <a key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} href={"#/admin?tab=" + id}>{label}</a>)}
      </nav>
      {err && <div className="card error">{err}</div>}
      {!members || !orders ? <div className="card muted">Chargement…</div> : (
        <>
          {tab === "tableau" && <Overview members={members} orders={orders} byId={byId} allTags={allTags} />}
          {tab === "membres" && <Members members={members} allTags={allTags} onOpen={setOpen} onWrite={write} />}
          {tab === "dons" && <Orders orders={orders} byId={byId} />}
          {tab === "messages" && <Messages members={members} allTags={allTags} draft={compose} clearDraft={() => setCompose(null)} />}
        </>
      )}
      {open && <MemberSheet member={open} allTags={allTags} orders={(orders || []).filter((o) => o.user_id === open.id)} onClose={() => setOpen(null)}
        onSaved={() => { setOpen(null); reload(); }} onWrite={(m) => { setOpen(null); write({ title: "", body: "", to: "users", user_ids: [m.id] }); }} />}
    </div>
  );
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

function Members({ members, allTags, onOpen, onWrite }: { members: Member[]; allTags: string[]; onOpen: (m: Member) => void; onWrite: (m: Outgoing) => void }) {
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
          <button className="btn" disabled={!sel.size} onClick={() => onWrite({ title: "", body: "", to: "users", user_ids: [...sel] })}>Écrire aux {sel.size || ""} sélectionné(s)</button>
        </div>
      </div>
      <ul className="member-list">
        {shown.map((m) => (
          <li key={m.id}>
            <input type="checkbox" aria-label={"Sélectionner " + fullName(m)} checked={sel.has(m.id)} onChange={() => toggle(m.id)} />
            <button className="member-row" onClick={() => onOpen(m)}>
              <span className="avatar" aria-hidden="true">{(m.first_name[0] || m.email[0] || "?").toUpperCase()}</span>
              <span className="member-main"><b>{fullName(m)}</b><span className="small muted">{m.email}{m.phone && " · " + m.phone}</span>
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

function MemberSheet({ member, allTags, orders, onClose, onSaved, onWrite }:
  { member: Member; allTags: string[]; orders: AdminOrder[]; onClose: () => void; onSaved: () => void; onWrite: (m: Member) => void }) {
  const [tags, setTags] = useState(member.tags);
  const [note, setNote] = useState(member.note);
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const addTag = (t: string) => { const v = t.trim(); if (v && !tags.includes(v)) setTags([...tags, v]); setAdd(""); };
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet card member-sheet" role="dialog" aria-label={fullName(member)} onClick={(e) => e.stopPropagation()}>
        <div className="card-head"><h2 className="serif gold-text">{fullName(member)}</h2><button className="btn ghost sm" aria-label="Fermer" onClick={onClose}>✕</button></div>
        <div className="small muted">{member.email}{member.phone && " · " + member.phone} · inscrit le {dateFr(member.created_at)}</div>
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
          <button className="btn ghost" onClick={() => onWrite(member)}>Écrire un message</button>
          <button className="btn" disabled={busy} onClick={() => { setBusy(true); saveMember(member.id, tags, note).then(onSaved, () => setBusy(false)); }}>{busy ? "…" : "Enregistrer"}</button>
        </div>
        <h3 className="serif">Historique</h3>
        <OrderList orders={orders} />
      </div>
    </div>
  );
}

function OrderList({ orders, byId }: { orders: AdminOrder[]; byId?: Map<string, Member> }) {
  if (!orders.length) return <p className="muted">Aucun don ni achat.</p>;
  return (
    <ul className="admin-list">
      {orders.map((o) => (
        <li key={o.id}>
          <div>
            <b>{byId ? fullName(byId.get(o.user_id || "")) + " · " : ""}{o.kind === "donation" ? "Don" : "Boutique"} · {o.label}</b>
            <div className="small muted">{dateFr(o.created_at)}{o.status !== "paid" && " · " + (o.status === "pending" ? "en attente" : "annulé")}</div>
            {o.dedication && <div className="small">Dédicace : « {o.dedication} »</div>}
            {o.order_items?.map((it, i) => <div key={i} className="small">{it.qty} × {it.name} (réf. {it.ref}){it.comment && " · « " + it.comment + " »"}</div>)}
          </div>
          <b className="num">{euros(o.total_cents)}</b>
        </li>
      ))}
    </ul>
  );
}

function Orders({ orders, byId }: { orders: AdminOrder[]; byId: Map<string, Member> }) {
  const [kind, setKind] = useState<"" | "donation" | "shop">("");
  const shown = orders.filter((o) => !kind || o.kind === kind);
  const total = shown.filter((o) => o.status === "paid").reduce((s, o) => s + o.total_cents, 0);
  const exportCsv = () => download("dons-et-achats.csv", toCsv([["Date", "Membre", "E-mail", "Type", "Motif", "Dédicace / commentaire", "Montant (€)", "État"],
    ...shown.map((o) => { const m = byId.get(o.user_id || ""); return [dateFr(o.created_at), fullName(m), m?.email || "", o.kind === "donation" ? "Don" : "Boutique", o.label,
      o.dedication || (o.order_items || []).map((i) => i.comment).filter(Boolean).join(" / "), (o.total_cents / 100).toFixed(2), o.status === "paid" ? "Payé" : o.status]; })]));
  return (
    <section className="card">
      <div className="admin-tools">
        <div className="chips">
          {([["", "Tout"], ["donation", "Dons"], ["shop", "Boutique"]] as const).map(([k, l]) => <button key={k} className={"chip" + (kind === k ? " on" : "")} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        <div className="row-end"><span className="muted">Total payé : <b className="gold-text num">{euros(total)}</b></span><button className="btn ghost" onClick={exportCsv}>Exporter (Excel)</button></div>
      </div>
      <OrderList orders={shown} byId={byId} />
    </section>
  );
}

function Messages({ members, allTags, draft, clearDraft }: { members: Member[]; allTags: string[]; draft: Outgoing | null; clearDraft: () => void }) {
  const [m, setM] = useState<Outgoing>(draft || { title: "", body: "", to: "all", tags: [] });
  const [sent, setSent] = useState<SentMessage[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (draft) { setM(draft); clearDraft(); } }, [draft, clearDraft]);
  useEffect(() => { listSent().then(setSent, () => setSent([])); }, []);
  const count = m.to === "all" ? members.length : m.to === "tags" ? members.filter((x) => x.tags.some((t) => (m.tags || []).includes(t))).length : (m.user_ids || []).length;
  const chosen = members.filter((x) => (m.user_ids || []).includes(x.id));
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try { const n = await sendMessage(m); setMsg("Message envoyé à " + n + " membre(s)."); setM({ title: "", body: "", to: "all", tags: [] }); setSent(await listSent()); }
    catch (x) { setMsg((x as Error).message); }
    setBusy(false);
  }
  return (
    <div className="grid-2">
      <form className="card" onSubmit={send}>
        <h2 className="serif gold-text">Nouveau message</h2>
        <div className="field"><span>Destinataires</span>
          <div className="seg three">
            <button type="button" className={m.to === "all" ? "on" : ""} onClick={() => setM({ ...m, to: "all" })}>Tous</button>
            <button type="button" className={m.to === "tags" ? "on" : ""} onClick={() => setM({ ...m, to: "tags" })}>Par balise</button>
            <button type="button" className={m.to === "users" ? "on" : ""} onClick={() => setM({ ...m, to: "users" })}>Choisis</button>
          </div>
          {m.to === "tags" && <div className="chips">{allTags.map((t) => { const on = (m.tags || []).includes(t);
            return <button type="button" key={t} className={"chip" + (on ? " on" : "")} onClick={() => setM({ ...m, tags: on ? (m.tags || []).filter((x) => x !== t) : [...(m.tags || []), t] })}>{t}</button>; })}</div>}
          {m.to === "users" && <div className="chips">{chosen.length ? chosen.map((x) => <span key={x.id} className="chip static">{fullName(x)}</span>) : <span className="small muted">Choisissez les membres dans l'onglet Membres (cases à cocher).</span>}</div>}
          <span className="small muted">{count} destinataire(s)</span>
        </div>
        <label className="field"><span>Titre</span><input id="msg-title" className="input" required maxLength={120} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} placeholder="Ex. Horaires de Hanoucca" /></label>
        <label className="field"><span>Message</span><textarea id="msg-body" className="input" required rows={5} maxLength={4000} value={m.body} onChange={(e) => setM({ ...m, body: e.target.value })} /></label>
        {msg && <p className="small gold">{msg}</p>}
        <button className="btn full" disabled={busy || !count}>{busy ? "Envoi…" : "Envoyer à " + count + " membre(s)"}</button>
        <p className="small muted">Le message arrive dans l'application, rubrique Compte › Messages.</p>
      </form>
      <section className="card">
        <h2 className="serif gold-text">Messages envoyés</h2>
        {!sent ? <div className="muted">Chargement…</div> : !sent.length ? <div className="muted">Aucun message envoyé.</div> : (
          <ul className="admin-list">{sent.map((s) => (
            <li key={s.id}><div><b>{s.title}</b><div className="small muted">{dateFr(s.created_at)} · {s.target}</div><div className="small msg-body">{s.body}</div></div>
              <span className="small muted right">lu par<br /><b className="num">{s.read}/{s.sent}</b></span></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
