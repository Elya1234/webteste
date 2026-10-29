// Supabase Edge Function « admin » : l'espace administrateur de l'application, ouvert avec un code (pas d'e-mail).
// Le code est vérifié ici, côté serveur : par défaut c'est le même que l'administration de l'écran (base Google,
// qui bloque après 10 essais faux) ; ou ADMIN_CODE s'il est défini. Le téléphone reçoit ensuite un jeton valable 12 h.
// Secrets : ADMIN_TOKEN_SECRET (texte long au hasard), REMOTE_URL (adresse de la base Google) ou ADMIN_CODE.
// Déployer avec --no-verify-jwt (l'administrateur n'a pas de compte Supabase).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import Stripe from "npm:stripe@22.6.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

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
  if (own) {
    // 10 essais faux en 10 minutes → blocage (même règle que la base Google de l'écran)
    const since = new Date(Date.now() - 10 * 60000).toISOString();
    const { count } = await admin.from("admin_attempts").select("*", { count: "exact", head: true }).gte("at", since);
    if ((count || 0) >= 10) return false;
    const good = code.length === own.length && crypto.subtle.timingSafeEqual
      ? crypto.subtle.timingSafeEqual(enc.encode(code), enc.encode(own)) : code === own;
    if (!good) await admin.from("admin_attempts").insert({});
    return good;
  }
  const r = await fetch(Deno.env.get("REMOTE_URL")!, { method: "POST", body: JSON.stringify({ action: "check", code }) });
  const j = await r.json().catch(() => ({}));
  return j.ok === true;
}

type Body = { action: string; table?: string; row?: Record<string, unknown>; name?: string; code?: string; token?: string; id?: string; tags?: string[]; note?: string; body?: string; amount_cents?: number;
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
  // ───────── contenus : boutique, cours, vidéos, galerie (champs autorisés seulement) ─────────
  const FIELDS: Record<string, string[]> = {
    products: ["ref", "name", "description", "category", "price_cents", "image_url", "stock", "comment_label", "active"],
    courses: ["title", "rav", "day", "time", "place", "audience", "description", "position"],
    videos: ["title", "rav", "youtube_id", "published_at"],
    gallery: ["url", "caption", "album"]
  };
  if ((b.action === "saveContent" || b.action === "deleteContent") && !(b.table && FIELDS[b.table])) return json({ error: "Table inconnue" }, 400);
  if (b.action === "saveContent" && b.row) {
    const row: Record<string, unknown> = {};
    for (const k of FIELDS[b.table!]) if (k in b.row) row[k] = typeof b.row[k] === "string" ? String(b.row[k]).slice(0, 2000) : b.row[k];
    if (b.table === "products" && !(Number(row.price_cents) > 0)) return json({ error: "Prix invalide." }, 400);
    if (b.table === "videos" && !/^[\w-]{11}$/.test(String(row.youtube_id || ""))) return json({ error: "Lien YouTube invalide." }, 400);
    const id = b.row.id ? String(b.row.id) : null;
    const { error } = id ? await admin.from(b.table!).update(row).eq("id", id) : await admin.from(b.table!).insert(row);
    return error ? json({ error: /duplicate/.test(error.message) ? "Cette référence existe déjà." : error.message }, 400) : json({ ok: true });
  }
  if (b.action === "deleteContent" && b.id) {
    const { error } = b.table === "products"
      ? await admin.from("products").update({ active: false }).eq("id", b.id) // un article déjà vendu reste dans l'historique
      : await admin.from(b.table!).delete().eq("id", b.id);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (b.action === "uploadUrl") {
    const path = new Date().toISOString().slice(0, 7) + "/" + crypto.randomUUID() + ".jpg";
    const { data, error } = await admin.storage.from("media").createSignedUploadUrl(path);
    if (error || !data) return json({ error: "Envoi impossible." }, 500);
    return json({ path, token: data.token, publicUrl: admin.storage.from("media").getPublicUrl(path).data.publicUrl });
  }

  // ───────── fiche de l'association ─────────
  if (b.action === "saveAssociation" && b.row) {
    const keys = ["legal_name", "address", "postal_code", "city", "rna", "siret", "email", "phone", "object", "president", "tax_receipts", "category"];
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of keys) if (k in b.row) row[k] = k === "tax_receipts" ? !!b.row[k] : String(b.row[k] ?? "").slice(0, 400);
    if (row.category && !["cultuelle", "interet_general", "utilite_publique"].includes(String(row.category))) delete row.category;
    const { error } = await admin.from("association").update(row).eq("id", 1);
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }

  // ───────── paiements : remboursement, dons mensuels ─────────
  if (b.action === "refund" && b.id) {
    const { data: o } = await admin.from("orders").select("*").eq("id", b.id).single();
    if (!o || o.status !== "paid" || !o.stripe_payment_intent) return json({ error: "Ce paiement ne peut pas être remboursé ici." }, 400);
    const left = o.total_cents - (o.refunded_cents || 0);
    const amount = b.amount_cents ? Math.round(Number(b.amount_cents)) : left;
    if (!(amount > 0 && amount <= left)) return json({ error: "Montant de remboursement invalide." }, 400);
    await stripe.refunds.create({ payment_intent: o.stripe_payment_intent, amount, metadata: { order_id: o.id } });
    const refunded = (o.refunded_cents || 0) + amount;
    await admin.from("orders").update({ refunded_cents: refunded, ...(refunded >= o.total_cents ? { status: "refunded" } : {}) }).eq("id", o.id);
    return json({ ok: true });
  }
  if (b.action === "subscriptions") {
    const { data } = await admin.from("subscriptions").select("*").order("created_at", { ascending: false });
    return json({ subscriptions: data || [] });
  }
  if (b.action === "cancelSub" && b.id) {
    await stripe.subscriptions.cancel(b.id);
    await admin.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", b.id);
    return json({ ok: true });
  }
  return json({ error: "Action inconnue" }, 400);
});
