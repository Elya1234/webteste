// Supabase Edge Function « admin » : l'espace administrateur de l'application, ouvert avec un code (pas d'e-mail).
// Le code est vérifié ici, côté serveur : par défaut c'est le même que l'administration de l'écran (base Google,
// qui bloque après 10 essais faux) ; ou ADMIN_CODE s'il est défini. Le téléphone reçoit ensuite un jeton valable 12 h.
// Secrets : ADMIN_TOKEN_SECRET (texte long au hasard), REMOTE_URL (adresse de la base Google) ou ADMIN_CODE.
// Déployer avec --no-verify-jwt (l'administrateur n'a pas de compte Supabase).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });
const enc = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(Deno.env.get("ADMIN_TOKEN_SECRET")!), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function makeToken() { const exp = String(Date.now() + 12 * 3600 * 1000); return exp + "." + (await hmac(exp)); }
async function validToken(t: string) {
  const [exp, sig] = String(t || "").split(".");
  return !!exp && Number(exp) > Date.now() && sig === (await hmac(exp));
}
async function checkCode(code: string) {
  const own = Deno.env.get("ADMIN_CODE");
  if (own) return code === own;
  const r = await fetch(Deno.env.get("REMOTE_URL")!, { method: "POST", body: JSON.stringify({ action: "check", code }) });
  const j = await r.json().catch(() => ({}));
  return j.ok === true;
}

type Body = { action: string; code?: string; token?: string; id?: string; tags?: string[]; note?: string; body?: string;
  message?: { title: string; body: string; to: "all" | "tags" | "users"; tags?: string[]; user_ids?: string[];
    kind?: "broadcast" | "reminder"; amount_cents?: number; purpose?: string } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const b = (await req.json().catch(() => ({}))) as Body;

  if (b.action === "login") {
    if (!b.code || !(await checkCode(String(b.code)))) return json({ error: "Code incorrect." }, 401);
    return json({ token: await makeToken() });
  }
  if (!(await validToken(b.token || ""))) return json({ error: "Session expirée : entrez à nouveau le code." }, 401);

  if (b.action === "members") {
    const [{ data: users }, { data: profiles }, { data: orders }] = await Promise.all([
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("profiles").select("*"),
      admin.from("orders").select("user_id, kind, total_cents, created_at").eq("status", "paid")
    ]);
    const members = (users?.users || []).map((u) => {
      const p = profiles?.find((x) => x.id === u.id) || {};
      const mine = (orders || []).filter((o) => o.user_id === u.id);
      return { id: u.id, email: u.email, created_at: u.created_at, first_name: p.first_name || "", last_name: p.last_name || "", phone: p.phone || "",
        tags: p.tags || [], note: p.admin_note || "",
        donated_cents: mine.filter((o) => o.kind === "donation").reduce((s, o) => s + o.total_cents, 0),
        spent_cents: mine.filter((o) => o.kind === "shop").reduce((s, o) => s + o.total_cents, 0),
        last_at: mine.map((o) => o.created_at).sort().pop() || null };
    });
    return json({ members });
  }
  if (b.action === "orders") {
    const q = admin.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(500);
    const { data, error } = b.id ? await q.eq("user_id", b.id) : await q;
    return error ? json({ error: error.message }, 500) : json({ orders: data });
  }
  if (b.action === "setMember" && b.id) {
    const tags = Array.from(new Set((b.tags || []).map((t) => String(t).trim().slice(0, 30)).filter(Boolean))).slice(0, 20);
    const { error } = await admin.from("profiles").update({ tags, admin_note: String(b.note || "").slice(0, 1000) }).eq("id", b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  // envoi de groupe (message ou rappel de paiement) : une ligne dans la conversation de chaque destinataire
  if (b.action === "send" && b.message) {
    const m = b.message;
    const title = String(m.title || "").trim().slice(0, 120), body = String(m.body || "").trim().slice(0, 4000);
    const kind = m.kind === "reminder" ? "reminder" : "broadcast";
    const amount = kind === "reminder" ? Math.round(Number(m.amount_cents)) : null;
    if (!title || !body) return json({ error: "Titre et message obligatoires." }, 400);
    if (kind === "reminder" && !(amount! >= 100 && amount! <= 10_000_000)) return json({ error: "Montant invalide." }, 400);
    let ids: string[] = [];
    if (m.to === "users") ids = (m.user_ids || []).map(String);
    else {
      const { data } = await admin.from("profiles").select("id, tags");
      ids = (data || []).filter((p) => m.to === "all" || (p.tags || []).some((t: string) => (m.tags || []).includes(t))).map((p) => p.id);
    }
    if (!ids.length) return json({ error: "Aucun destinataire." }, 400);
    const target = m.to === "all" ? "Tous" : m.to === "tags" ? "Balise : " + (m.tags || []).join(", ") : ids.length + " membre(s)";
    const { data: msg, error } = await admin.from("messages").insert({ kind, title, body, target }).select("id").single();
    if (error || !msg) return json({ error: "Message non enregistré." }, 500);
    const purpose = kind === "reminder" ? String(m.purpose || "Cotisation annuelle").slice(0, 80) : null;
    await admin.from("chat_messages").insert(ids.map((user_id) => ({ user_id, from_admin: true, kind, title, body, amount_cents: amount, purpose, broadcast_id: msg.id })));
    return json({ ok: true, count: ids.length });
  }
  if (b.action === "messages") {
    const { data } = await admin.from("messages").select("*, chat_messages(read_at)").order("created_at", { ascending: false }).limit(200);
    return json({ messages: (data || []).map((m) => ({ id: m.id, created_at: m.created_at, kind: m.kind, title: m.title, body: m.body, target: m.target,
      sent: m.chat_messages.length, read: m.chat_messages.filter((r: { read_at: string | null }) => r.read_at).length })) });
  }
  // conversations privées
  if (b.action === "threads") {
    const { data } = await admin.from("chat_messages").select("user_id, from_admin, kind, body, title, created_at, read_at").order("created_at", { ascending: false }).limit(5000);
    const map = new Map<string, { user_id: string; last: unknown; unread: number }>();
    for (const r of data || []) {
      const t = map.get(r.user_id) || { user_id: r.user_id, last: r, unread: 0 };
      if (!r.from_admin && !r.read_at) t.unread++;
      map.set(r.user_id, t);
    }
    return json({ threads: [...map.values()] });
  }
  if (b.action === "thread" && b.id) {
    await admin.from("chat_messages").update({ read_at: new Date().toISOString() }).eq("user_id", b.id).eq("from_admin", false).is("read_at", null);
    const { data } = await admin.from("chat_messages").select("*").eq("user_id", b.id).order("created_at").limit(1000);
    return json({ messages: data || [] });
  }
  if (b.action === "reply" && b.id) {
    const body = String(b.body || "").trim().slice(0, 4000);
    if (!body) return json({ error: "Message vide." }, 400);
    const { error } = await admin.from("chat_messages").insert({ user_id: b.id, from_admin: true, kind: "text", body });
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  return json({ error: "Action inconnue" }, 400);
});
