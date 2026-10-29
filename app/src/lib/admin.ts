/* Espace administrateur : entrée par code (le même que l'administration de l'écran), sans e-mail.
 * - Avec Supabase : tout passe par la fonction serveur « admin », qui vérifie le code et renvoie un jeton de 12 h.
 * - Sans (démonstration) : le code est vérifié par la base Google de l'écran, les données sont des exemples gardés sur l'appareil. */
import { REMOTE_URL } from "../config";
import { saveDemoAssociation, type Association, DEMO, demoChat, demoContent, saveDemoChat, saveDemoContent, supabase, K_DEMO_ORDERS, K_DEMO_SUBS, type ContentTable, type ChatMessage, type Order, type Profile, type Subscription } from "./backend";
import { read, write } from "./storage";

export type Member = { id: string; email: string; created_at: string; first_name: string; last_name: string; phone: string;
  tags: string[]; note: string; donated_cents: number; spent_cents: number; last_at: string | null };
export type AdminOrder = Order & { user_id: string | null; purpose?: string | null; dedication?: string | null;
  order_items?: { ref: string; name: string; qty: number; unit_cents: number; comment: string }[] };
export type SentMessage = { id: string; created_at: string; kind?: "broadcast" | "reminder"; title: string; body: string; target: string; sent: number; read: number };
export type Thread = { user_id: string; last: ChatMessage; unread: number };
export type Outgoing = { title: string; body: string; to: "all" | "tags" | "users"; tags?: string[]; user_ids?: string[];
  kind?: "broadcast" | "reminder"; amount_cents?: number; purpose?: string };

const K_TOKEN = "app.admin.token";
const ss = {
  get: () => { try { return sessionStorage.getItem(K_TOKEN); } catch { return null; } },
  set: (v: string | null) => { try { if (v) sessionStorage.setItem(K_TOKEN, v); else sessionStorage.removeItem(K_TOKEN); } catch { /* mode privé */ } }
};
export const isAdmin = () => !!ss.get();
export const adminLogout = () => ss.set(null);

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase!.functions.invoke("admin", { body: { action, token: ss.get(), ...extra } });
  if (error) {
    const msg = await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j.error).catch(() => null);
    if (/expirée/.test(msg || "")) ss.set(null);
    throw new Error(msg || "Le serveur ne répond pas. Réessayez.");
  }
  return data as T;
}

export async function adminLogin(code: string) {
  if (!DEMO) { const r = await call<{ token: string }>("login", { code }); ss.set(r.token); return; }
  // démonstration : même vérification que la page d'administration de l'écran (base Google, côté serveur)
  const r = await fetch(REMOTE_URL, { method: "POST", body: JSON.stringify({ action: "check", code }) }).then((x) => x.json()).catch(() => null);
  if (!r) throw new Error("Pas de connexion. Réessayez.");
  if (!r.ok) throw new Error(r.error || "Code incorrect.");
  ss.set("demo");
}

/* ───────── Démonstration : aucune donnée inventée ─────────
 * Seul le compte créé sur cet appareil apparaît, avec ses vrais paiements et messages de démonstration. */
const K_DEMO = "app.admin.demo.v2";
type DemoDb = { members: Member[]; orders: AdminOrder[]; messages: SentMessage[] };
function demoDb(): DemoDb {
  return read<DemoDb>(K_DEMO) || { members: [], orders: [], messages: [] };
}
function withTotals(db: DemoDb): Member[] {
  return db.members.map((mb) => {
    const mine = db.orders.filter((o) => o.user_id === mb.id && o.status === "paid");
    return { ...mb, donated_cents: mine.filter((o) => o.kind === "donation").reduce((s, o) => s + o.total_cents, 0),
      spent_cents: mine.filter((o) => o.kind === "shop").reduce((s, o) => s + o.total_cents, 0),
      last_at: mine.map((o) => o.created_at).sort().pop() || null };
  });
}

/* ───────── Opérations ───────── */
export async function listMembers(): Promise<Member[]> {
  if (!DEMO) return (await call<{ members: Member[] }>("members")).members;
  return withTotals(withDemoUser(demoDb()));
}
/* démonstration : le compte créé sur cet appareil apparaît aussi dans la liste, avec ses vraies commandes de démonstration */
function withDemoUser(db: DemoDb): DemoDb {
  const p = read<Profile>("app.demo.user");
  if (!p || db.members.some((m) => m.id === "demo")) return db;
  const own = (read<Order[]>("app.demo.orders") || []).map((o) => ({ ...o, user_id: "demo" }));
  return { ...db, members: [{ id: "demo", email: p.email, created_at: new Date().toISOString(), first_name: p.first_name || "Compte", last_name: p.last_name || "de démonstration",
    phone: p.phone, tags: [], note: "", donated_cents: 0, spent_cents: 0, last_at: null }, ...db.members], orders: [...own, ...db.orders] };
}
export async function listAllOrders(userId?: string): Promise<AdminOrder[]> {
  if (!DEMO) return (await call<{ orders: AdminOrder[] }>("orders", userId ? { id: userId } : {})).orders;
  const all = withDemoUser(demoDb()).orders.map((o) => ({ ...o, refunded_cents: (read<Record<string, number>>(K_REFUNDS) || {})[o.id] ?? o.refunded_cents,
    status: (read<Record<string, number>>(K_REFUNDS) || {})[o.id] >= o.total_cents ? "refunded" as const : o.status })).slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return userId ? all.filter((o) => o.user_id === userId) : all;
}
export async function saveMember(id: string, tags: string[], note: string) {
  if (!DEMO) { await call("setMember", { id, tags, note }); return; }
  const db = demoDb();
  if (id === "demo" && !db.members.some((m) => m.id === "demo")) db.members.unshift(withDemoUser(db).members[0]);
  db.members = db.members.map((m) => (m.id === id ? { ...m, tags, note } : m));
  write(K_DEMO, db);
}
export async function sendMessage(msg: Outgoing): Promise<number> {
  if (!DEMO) return (await call<{ count: number }>("send", { message: msg })).count;
  const db = withDemoUser(demoDb());
  const ids = msg.to === "users" ? msg.user_ids || [] : db.members.filter((m) => msg.to === "all" || m.tags.some((t) => (msg.tags || []).includes(t))).map((m) => m.id);
  if (!ids.length) throw new Error("Aucun destinataire.");
  if (msg.kind === "reminder" && !(Number(msg.amount_cents) >= 100)) throw new Error("Montant invalide.");
  const target = msg.to === "all" ? "Tous" : msg.to === "tags" ? "Balise : " + (msg.tags || []).join(", ") : ids.length + " membre(s)";
  const base = demoDb();
  base.messages.unshift({ id: "s" + Date.now(), created_at: new Date().toISOString(), kind: msg.kind || "broadcast", title: msg.title, body: msg.body, target, sent: ids.length, read: 0 });
  write(K_DEMO, base);
  const c = demoChat(), now = new Date().toISOString();
  ids.forEach((id, i) => { c[id] = [...(c[id] || []), { id: "b" + Date.now() + i, user_id: id, from_admin: true, kind: msg.kind || "broadcast", title: msg.title, body: msg.body,
    amount_cents: msg.kind === "reminder" ? msg.amount_cents : null, purpose: msg.kind === "reminder" ? msg.purpose : null, created_at: now, read_at: null }]; });
  saveDemoChat(c);
  return ids.length;
}

/* ───────── Conversations privées ───────── */
export async function listThreads(): Promise<Thread[]> {
  if (!DEMO) return (await call<{ threads: Thread[] }>("threads")).threads;
  return Object.entries(demoChat()).filter(([, l]) => l.length).map(([user_id, l]) => ({ user_id, last: l[l.length - 1], unread: l.filter((m) => !m.from_admin && !m.read_at).length }))
    .sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}
export async function getThread(userId: string): Promise<ChatMessage[]> {
  if (!DEMO) return (await call<{ messages: ChatMessage[] }>("thread", { id: userId })).messages;
  const c = demoChat();
  c[userId] = (c[userId] || []).map((m) => (!m.from_admin && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m));
  saveDemoChat(c);
  return c[userId];
}
export async function replyTo(userId: string, body: string) {
  const text = body.trim(); if (!text) return;
  if (!DEMO) { await call("reply", { id: userId, body: text }); return; }
  const c = demoChat();
  c[userId] = [...(c[userId] || []), { id: "r" + Date.now(), user_id: userId, from_admin: true, kind: "text", body: text, created_at: new Date().toISOString(), read_at: null }];
  saveDemoChat(c);
}

export async function listSent(): Promise<SentMessage[]> {
  if (!DEMO) return (await call<{ messages: SentMessage[] }>("messages")).messages;
  return demoDb().messages;
}

/** Fichier tableur (CSV, ouvert par Excel) : liste des membres ou des dons, pour la comptabilité et les reçus. */
export function toCsv(rows: (string | number)[][]) {
  return "﻿" + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
}

/* ───────── Paiements : remboursements et dons mensuels ───────── */
const K_REFUNDS = "app.admin.demo.refunds";
export async function refundOrder(id: string, amount_cents?: number) {
  if (!DEMO) { await call("refund", { id, amount_cents }); return; }
  const o = (await listAllOrders()).find((x) => x.id === id);
  if (!o || o.status !== "paid") throw new Error("Ce paiement ne peut pas être remboursé ici.");
  const left = o.total_cents - (o.refunded_cents || 0), amount = amount_cents || left;
  if (!(amount > 0 && amount <= left)) throw new Error("Montant de remboursement invalide.");
  const r = read<Record<string, number>>(K_REFUNDS) || {}; r[id] = (o.refunded_cents || 0) + amount; write(K_REFUNDS, r);
  if (o.user_id === "demo") write(K_DEMO_ORDERS, (read<Order[]>(K_DEMO_ORDERS) || []).map((x) => (x.id === id ? { ...x, refunded_cents: r[id], status: r[id] >= x.total_cents ? "refunded" : x.status } : x)));
}
export async function listSubscriptions(): Promise<Subscription[]> {
  if (!DEMO) return (await call<{ subscriptions: Subscription[] }>("subscriptions")).subscriptions;
  const canceled = read<string[]>(K_SUBS_CANCELED) || [];
  return (read<Subscription[]>(K_DEMO_SUBS) || []).map((x) => (canceled.includes(x.id) ? { ...x, status: "canceled" } : x));
}
const K_SUBS_CANCELED = "app.admin.demo.subscanceled";
export async function cancelSubscription(id: string) {
  if (!DEMO) { await call("cancelSub", { id }); return; }
  write(K_SUBS_CANCELED, [...(read<string[]>(K_SUBS_CANCELED) || []), id]);
  write(K_DEMO_SUBS, (read<Subscription[]>(K_DEMO_SUBS) || []).map((x) => (x.id === id ? { ...x, status: "canceled", canceled_at: new Date().toISOString() } : x)));
}

/* ───────── Contenus : boutique, cours, vidéos, galerie ───────── */
export type ContentRow = Record<string, unknown> & { id?: string };
export async function saveContent(table: ContentTable, row: ContentRow): Promise<void> {
  if (!DEMO) { await call("saveContent", { table, row }); return; }
  const rows = demoContent<ContentRow>(table);
  const id = row.id || table.slice(0, 1) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const next = { ...row, id, ...(row.id ? {} : { created_at: new Date().toISOString() }) };
  saveDemoContent(table, row.id ? rows.map((r) => (r.id === row.id ? { ...r, ...next } : r)) : [...rows, next]);
}
export async function deleteContent(table: ContentTable, id: string) {
  if (!DEMO) { await call("deleteContent", { table, id }); return; }
  saveDemoContent(table, demoContent<ContentRow>(table).filter((r) => r.id !== id));
}

/** Photo : réduite à 1600 px (JPEG) sur l'appareil, puis envoyée (Supabase Storage) ; démonstration : gardée sur l'appareil. */
export async function uploadImage(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size > 15 * 1024 * 1024) throw new Error("Photo JPEG, PNG ou WebP de moins de 15 Mo.");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, (DEMO ? 1000 : 1600) / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  if (DEMO) return c.toDataURL("image/jpeg", 0.78);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.85));
  const { path, token, publicUrl } = await call<{ path: string; token: string; publicUrl: string }>("uploadUrl", { name: file.name });
  const { error } = await supabase!.storage.from("media").uploadToSignedUrl(path, token, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Envoi de la photo impossible. Réessayez.");
  return publicUrl;
}

export async function saveAssociation(a: Association) {
  if (!DEMO) { await call("saveAssociation", { row: a }); return; }
  saveDemoAssociation(a);
}
