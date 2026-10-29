/* Espace administrateur : entrée par code (le même que l'administration de l'écran), sans e-mail.
 * - Avec Supabase : tout passe par la fonction serveur « admin », qui vérifie le code et renvoie un jeton de 12 h.
 * - Sans (démonstration) : le code est vérifié par la base Google de l'écran, les données sont des exemples gardés sur l'appareil. */
import { REMOTE_URL } from "../config";
import { DEMO, supabase, type Order } from "./backend";
import { read, write } from "./storage";

export type Member = { id: string; email: string; created_at: string; first_name: string; last_name: string; phone: string;
  tags: string[]; note: string; donated_cents: number; spent_cents: number; last_at: string | null };
export type AdminOrder = Order & { user_id: string | null; purpose?: string | null; dedication?: string | null;
  order_items?: { ref: string; name: string; qty: number; unit_cents: number; comment: string }[] };
export type SentMessage = { id: string; created_at: string; title: string; body: string; target: string; sent: number; read: number };
export type Outgoing = { title: string; body: string; to: "all" | "tags" | "users"; tags?: string[]; user_ids?: string[] };

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

/* ───────── Exemples pour la démonstration (aucune vraie personne) ───────── */
const K_DEMO = "app.admin.demo.v1";
type DemoDb = { members: Member[]; orders: AdminOrder[]; messages: SentMessage[] };
function demoDb(): DemoDb {
  const saved = read<DemoDb>(K_DEMO);
  if (saved) return saved;
  const d = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const m = (id: string, first: string, last: string, tags: string[], days: number): Member =>
    ({ id, email: (first + "." + last).toLowerCase().replace(/[^a-z.]/g, "") + "@exemple.fr", created_at: d(days), first_name: first, last_name: last,
       phone: "06 00 00 00 " + id.slice(1).padStart(2, "0"), tags, note: "", donated_cents: 0, spent_cents: 0, last_at: null });
  const members = [
    m("m1", "David", "Exemple", ["Cotisant", "Conseil"], 210), m("m2", "Sarah", "Exemple", ["Cotisant", "Femmes"], 180),
    m("m3", "Yossef", "Exemple", ["Cotisant"], 150), m("m4", "Rivka", "Exemple", ["Femmes"], 95), m("m5", "Moché", "Exemple", ["Jeunes"], 60),
    m("m6", "Esther", "Exemple", [], 30), m("m7", "Aharon", "Exemple", ["Conseil"], 12), m("m8", "Léa", "Exemple", ["Jeunes", "Femmes"], 3)
  ];
  const o = (id: string, user: string, kind: "shop" | "donation", cents: number, label: string, days: number, extra: Partial<AdminOrder> = {}): AdminOrder =>
    ({ id, user_id: user, kind, total_cents: cents, label, status: "paid", created_at: d(days), ...extra });
  const orders: AdminOrder[] = [
    o("o1", "m1", "donation", 36000, "Cotisation annuelle", 200, { purpose: "Cotisation annuelle" }),
    o("o2", "m1", "donation", 18000, "Kibboud / Mitsva (montée à la Torah)", 40, { purpose: "Kibboud", dedication: "Leilouy Nichmat de mon père" }),
    o("o3", "m2", "donation", 36000, "Cotisation annuelle", 170, { purpose: "Cotisation annuelle" }),
    o("o4", "m2", "shop", 3600, "1 article(s)", 25, { order_items: [{ ref: "DED-010", name: "Dédicace d'un livre de la synagogue", qty: 1, unit_cents: 3600, comment: "Refoua Chelema" }] }),
    o("o5", "m3", "donation", 5400, "Hazkara / Leilouy Nichmat", 14, { purpose: "Hazkara", dedication: "Leilouy Nichmat" }),
    o("o6", "m4", "shop", 3700, "2 article(s)", 9, { order_items: [{ ref: "SID-001", name: "Siddour Patah Eliyahou", qty: 1, unit_cents: 2500, comment: "" }, { ref: "KIP-030", name: "Kippa brodée", qty: 1, unit_cents: 1200, comment: "" }] }),
    o("o7", "m5", "donation", 1800, "Don général", 5, { purpose: "Don général" }),
    o("o8", "m7", "donation", 10000, "Neder", 2, { purpose: "Neder" })
  ];
  const messages: SentMessage[] = [{ id: "s1", created_at: d(6), title: "Horaires de Souccot", body: "Les horaires des offices de Souccot sont disponibles dans l'application.", target: "Tous", sent: 8, read: 6 }];
  const db = { members, orders, messages };
  write(K_DEMO, db);
  return db;
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
  return withTotals(demoDb());
}
export async function listAllOrders(userId?: string): Promise<AdminOrder[]> {
  if (!DEMO) return (await call<{ orders: AdminOrder[] }>("orders", userId ? { id: userId } : {})).orders;
  const all = demoDb().orders.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  return userId ? all.filter((o) => o.user_id === userId) : all;
}
export async function saveMember(id: string, tags: string[], note: string) {
  if (!DEMO) { await call("setMember", { id, tags, note }); return; }
  const db = demoDb();
  db.members = db.members.map((m) => (m.id === id ? { ...m, tags, note } : m));
  write(K_DEMO, db);
}
export async function sendMessage(msg: Outgoing): Promise<number> {
  if (!DEMO) return (await call<{ count: number }>("send", { message: msg })).count;
  const db = demoDb();
  const ids = msg.to === "users" ? msg.user_ids || [] : db.members.filter((m) => msg.to === "all" || m.tags.some((t) => (msg.tags || []).includes(t))).map((m) => m.id);
  if (!ids.length) throw new Error("Aucun destinataire.");
  const target = msg.to === "all" ? "Tous" : msg.to === "tags" ? "Balise : " + (msg.tags || []).join(", ") : ids.length + " membre(s)";
  db.messages.unshift({ id: "s" + Date.now(), created_at: new Date().toISOString(), title: msg.title, body: msg.body, target, sent: ids.length, read: 0 });
  write(K_DEMO, db);
  // démonstration : un message « à tous » arrive aussi dans la boîte du compte de démonstration de cet appareil
  if (msg.to === "all") write("app.demo.inbox", [{ id: "i" + Date.now(), created_at: new Date().toISOString(), title: msg.title, body: msg.body, read_at: null }, ...(read<unknown[]>("app.demo.inbox") || [])]);
  return ids.length;
}
export async function listSent(): Promise<SentMessage[]> {
  if (!DEMO) return (await call<{ messages: SentMessage[] }>("messages")).messages;
  return demoDb().messages;
}

/** Fichier tableur (CSV, ouvert par Excel) : liste des membres ou des dons, pour la comptabilité et les reçus. */
export function toCsv(rows: (string | number)[][]) {
  return "﻿" + rows.map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(";")).join("\r\n");
}
