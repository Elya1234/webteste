import { useEffect, useRef, useState } from "react";
import { euros, listChat, markChatRead, sendChat, type ChatMessage } from "../lib/backend";
import { useAuth } from "../lib/auth";
import { go } from "../lib/router";

/* Conversation privée avec l'administration (membre) ; le même affichage sert à l'administration. */
const time = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const payHref = (m: ChatMessage) => "#/dons?" + new URLSearchParams({ montant: String(m.amount_cents || ""), motif: m.purpose || "" }).toString();

export function ChatThread({ messages, side, onSend, sending }: { messages: ChatMessage[]; side: "member" | "admin"; onSend: (t: string) => Promise<void>; sending?: boolean }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  const mine = (m: ChatMessage) => (side === "member" ? !m.from_admin : m.from_admin);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { await onSend(text); setText(""); } catch { setErr("Message non envoyé. Vérifiez votre connexion."); }
  }
  return (
    <div className="chat">
      <div className="chat-list" aria-live="polite">
        {!messages.length && <p className="muted center">Aucun message pour le moment. Écrivez ci-dessous : l'administration vous répondra ici.</p>}
        {messages.map((m) => (
          <div key={m.id} className={"bubble " + (mine(m) ? "me" : "them") + (m.kind !== "text" ? " " + m.kind : "")}>
            {m.kind === "reminder" && <span className="bubble-tag">Rappel de paiement</span>}
            {m.kind === "broadcast" && <span className="bubble-tag">Message à la communauté</span>}
            {m.title && <b className="bubble-title">{m.title}</b>}
            <p>{m.body}</p>
            {m.kind === "reminder" && m.amount_cents ? (
              side === "member"
                ? <a className="btn" href={payHref(m)}>Payer {euros(m.amount_cents)}{m.purpose ? " · " + m.purpose : ""}</a>
                : <span className="small gold">{euros(m.amount_cents)}{m.purpose ? " · " + m.purpose : ""}</span>
            ) : null}
            <span className="bubble-meta">{time(m.created_at)}{mine(m) && (m.read_at ? " · Lu" : " · Envoyé")}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={submit}>
        <textarea id={"chat-" + side} className="input" rows={1} maxLength={4000} placeholder={side === "member" ? "Écrire à l'administration…" : "Répondre…"}
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
        <button className="btn" disabled={!text.trim() || sending} aria-label="Envoyer">Envoyer</button>
      </form>
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

export default function Messages() {
  const { profile, loading } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const load = () => listChat().then((l) => { setMsgs(l); if (l.some((m) => m.from_admin && !m.read_at)) markChatRead(); }, () => setMsgs((x) => x || []));
  useEffect(() => {
    if (!profile) return;
    load();
    const id = setInterval(load, 20000); // nouvelles réponses toutes les 20 s quand la conversation est ouverte
    const f = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", f);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", f); };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="page narrow"><div className="card muted">Chargement…</div></div>;
  if (!profile) return (
    <div className="page narrow"><div className="card"><h2 className="serif gold-text">Messages</h2><p>Connectez-vous pour écrire à l'administration et recevoir ses messages.</p>
      <button className="btn" onClick={() => go("compte", "suite=messages")}>Se connecter ou créer un compte</button></div></div>
  );
  return (
    <div className="page narrow">
      <nav className="crumbs"><a href="#/compte">‹ Mon compte</a></nav>
      <header className="page-head"><h1 className="serif gold-text">Messages</h1><p className="muted">Votre conversation privée avec l'administration de la synagogue.</p></header>
      <section className="card">
        {!msgs ? <div className="muted">Chargement…</div> : <ChatThread messages={msgs} side="member" onSend={async (t) => { await sendChat(t); await load(); }} />}
      </section>
    </div>
  );
}
