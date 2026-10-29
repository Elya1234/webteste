/* Comptes, boutique, commandes et dons.
 * - Avec VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY : vraie base Supabase + paiement Stripe (fonction « checkout »).
 * - Sans : mode démonstration, tout reste sur l'appareil et aucun paiement n'est encaissé. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { read, write } from "./storage";
import { loc } from "./i18n";
import { checkPassword } from "./validate";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// Session gardée sur l'appareil et renouvelée seule : un membre reste connecté jusqu'à ce qu'il se déconnecte.
export const supabase: SupabaseClient | null = URL_ && KEY
  ? createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "bethchalom.session" } })
  : null;
export const DEMO = !supabase;

export type Product = {
  id: string; ref: string; name: string; description: string; category: string;
  price_cents: number; image_url: string | null; stock: number | null;
  /** Si renseigné, l'acheteur doit écrire un commentaire (ex. « Nom pour la dédicace »). */
  comment_label: string | null; active: boolean;
};
export type Profile = { id: string; email: string; first_name: string; last_name: string; phone: string; address?: string; postal_code?: string; city?: string };
export type CartLine = { product_id: string; qty: number; comment: string };
export type OrderStatus = "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded";
export type Order = { id: string; created_at: string; status: OrderStatus; total_cents: number; kind: "shop" | "donation"; label: string;
  payment_method?: string | null; receipt_url?: string | null; refunded_cents?: number; purpose?: string | null; dedication?: string | null; stripe_subscription_id?: string | null;
  order_items?: OrderItem[] };
export type OrderItem = { ref: string; name: string; qty: number; unit_cents: number; comment: string };
export type Subscription = { id: string; user_id: string | null; amount_cents: number; purpose: string; dedication?: string | null; status: string; created_at: string; canceled_at?: string | null };
/** Nom lisible du moyen de paiement */
export const METHOD: Record<string, string> = { card: "Carte bancaire", apple_pay: "Apple Pay", google_pay: "Google Pay", sepa_debit: "Prélèvement SEPA", link: "Link", paypal: "PayPal" };
export type DonationInput = { amount_cents: number; purpose: string; dedication: string; monthly?: boolean };

export const euros = (c: number) => (c / 100).toLocaleString(loc(), { style: "currency", currency: "EUR" });

/* ───────── Contenus (boutique, cours, vidéos, galerie) ─────────
 * Avec Supabase : les tables du même nom, remplies depuis l'administration. Démonstration : gardés sur cet appareil.
 * Aucun exemple : tout part vide, l'administration ajoute ce qu'il faut. */
export type ContentTable = "products" | "courses" | "videos" | "gallery";
export const demoContent = <T,>(table: ContentTable) => read<T[]>("app.demo.content." + table) || [];
export const saveDemoContent = (table: ContentTable, rows: unknown[]) => write("app.demo.content." + table, rows);

export async function listProducts(all = false): Promise<Product[]> {
  if (!supabase) return demoContent<Product>("products").filter((p) => all || p.active).sort((x, y) => x.category.localeCompare(y.category) || x.name.localeCompare(y.name));
  let q = supabase.from("products").select("*").order("category").order("name");
  if (!all) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data as Product[];
}

/* ───────── Comptes ───────── */
const K_DEMO_USER = "app.demo.user", K_DEMO_ORDERS = "app.demo.orders";

export async function currentProfile(): Promise<Profile | null> {
  if (!supabase) return read<Profile>(K_DEMO_USER);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email || "", first_name: data?.first_name || "", last_name: data?.last_name || "", phone: data?.phone || "",
    address: data?.address || "", postal_code: data?.postal_code || "", city: data?.city || "" };
}

/* Démonstration : le mot de passe n'est jamais gardé en clair, seulement son empreinte (PBKDF2, 150 000 tours). */
const K_DEMO_ACCOUNT = "app.demo.account", K_DEMO_FAILS = "app.demo.fails";
type DemoAccount = { email: string; salt: string; hash: string; profile: Profile };
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
async function pbkdf2(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 150000 }, key, 256));
}
function guard() {
  const f = read<{ n: number; until: number }>(K_DEMO_FAILS);
  if (f && f.until > Date.now()) throw new Error("too_many");
}
function failed() {
  const f = read<{ n: number; until: number }>(K_DEMO_FAILS) || { n: 0, until: 0 };
  const n = f.n + 1;
  write(K_DEMO_FAILS, n >= 5 ? { n: 0, until: Date.now() + 5 * 60000 } : { n, until: 0 }); // 5 essais faux → 5 minutes d'attente
}

export async function signUp(email: string, password: string, info: Pick<Profile, "first_name" | "last_name" | "phone">) {
  email = email.trim().toLowerCase();
  if (!checkPassword(password, [email, info.first_name, info.last_name]).ok) throw new Error("weak_password");
  if (info.phone && !/^\+(33[1-9]\d{8}|1[2-9]\d{2}[2-9]\d{6})$/.test(info.phone)) throw new Error("bad_phone");
  if (!supabase) {
    const acc = read<DemoAccount>(K_DEMO_ACCOUNT);
    if (acc && acc.email === email) throw new Error("User already registered");
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    const profile = { id: "demo", email, ...info };
    write(K_DEMO_ACCOUNT, { email, salt, hash: await pbkdf2(password, salt), profile });
    write(K_DEMO_USER, profile);
    return { needsConfirmation: false };
  }
  // le profil est créé par un déclencheur SQL à partir de ces métadonnées (voir supabase/schema.sql)
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: info } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string) {
  email = email.trim().toLowerCase();
  if (!supabase) {
    guard();
    const acc = read<DemoAccount>(K_DEMO_ACCOUNT);
    if (!acc || acc.email !== email || (await pbkdf2(password, acc.salt)) !== acc.hash) { failed(); throw new Error("Invalid login credentials"); }
    write(K_DEMO_FAILS, null);
    write(K_DEMO_USER, acc.profile);
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function resetPassword(email: string) {
  if (!supabase) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) { try { localStorage.removeItem(K_DEMO_USER); } catch { /* mode privé */ } return; }
  await supabase.auth.signOut();
}

export async function updateProfile(p: Profile) {
  if (p.phone && !/^\+(33[1-9]\d{8}|1[2-9]\d{2}[2-9]\d{6})$/.test(p.phone)) throw new Error("bad_phone");
  if (!supabase) { write(K_DEMO_USER, p); const a = read<DemoAccount>(K_DEMO_ACCOUNT); if (a) write(K_DEMO_ACCOUNT, { ...a, profile: p }); return; }
  const { error } = await supabase.from("profiles").update({ first_name: p.first_name, last_name: p.last_name, phone: p.phone,
    address: (p.address || "").slice(0, 200), postal_code: (p.postal_code || "").slice(0, 10), city: (p.city || "").slice(0, 80) }).eq("id", p.id);
  if (error) throw error;
}

export function onAuthChange(cb: () => void) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange(() => cb());
  return () => data.subscription.unsubscribe();
}

/* ───────── Commandes et dons ───────── */
export async function listOrders(): Promise<Order[]> {
  if (!supabase) return read<Order[]>(K_DEMO_ORDERS) || [];
  const { data, error } = await supabase.from("orders").select("id, created_at, status, total_cents, kind, label, payment_method, receipt_url, refunded_cents, purpose, stripe_subscription_id").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
}

/** Lance le paiement. Les prix sont recalculés côté serveur : le téléphone n'envoie que les références et quantités.
 * Démonstration : ouvre une page de paiement simulée (#/paiement) au lieu de Stripe. */
export async function checkout(body: { cart: CartLine[] } | { donation: DonationInput }): Promise<{ url: string }> {
  if (!supabase) {
    const isShop = "cart" in body;
    const total = isShop
      ? body.cart.reduce((s, l) => s + (demoContent<Product>("products").find((p) => p.id === l.product_id)?.price_cents || 0) * l.qty, 0)
      : body.donation.amount_cents;
    write(K_DEMO_PENDING, { body, total, label: isShop ? body.cart.reduce((s, l) => s + l.qty, 0) + " article(s)" : body.donation.purpose });
    return { url: "#/paiement" };
  }
  const { data, error } = await supabase.functions.invoke("checkout", {
    // appli iPhone/Android : Stripe s'ouvre dans le navigateur et revient sur la version web (VITE_WEB_URL)
    body: { ...body, return_url: Capacitor.isNativePlatform() ? import.meta.env.VITE_WEB_URL : window.location.origin + window.location.pathname }
  });
  if (error) throw error;
  return { url: (data as { url: string }).url };
}

/* ───────── Démonstration : paiement simulé ───────── */
const K_DEMO_PENDING = "app.demo.pending", K_DEMO_SUBS = "app.demo.subs";
export type DemoPending = { body: { cart: CartLine[] } | { donation: DonationInput }; total: number; label: string };
export const demoPending = () => read<DemoPending>(K_DEMO_PENDING);
export function demoComplete(method: string): Order {
  const p = demoPending()!;
  const isShop = "cart" in p.body;
  const d = isShop ? null : (p.body as { donation: DonationInput }).donation;
  const sub: Subscription | null = d?.monthly ? { id: "sub_demo" + Date.now(), user_id: "demo", amount_cents: p.total, purpose: d.purpose, dedication: d.dedication, status: "active", created_at: new Date().toISOString() } : null;
  const o: Order = { id: "D" + Date.now().toString(36).toUpperCase(), created_at: new Date().toISOString(), status: method === "sepa_debit" ? "processing" : "paid",
    total_cents: p.total, kind: isShop ? "shop" : "donation", label: d?.monthly ? p.label + " (mensuel)" : p.label, payment_method: method,
    receipt_url: null, refunded_cents: 0, purpose: d?.purpose || null, dedication: d?.dedication || null, stripe_subscription_id: sub?.id || null,
    order_items: isShop ? (p.body as { cart: CartLine[] }).cart.map((l) => { const pr = demoContent<Product>("products").find((x) => x.id === l.product_id);
      return { ref: pr?.ref || "", name: pr?.name || "", qty: l.qty, unit_cents: pr?.price_cents || 0, comment: l.comment }; }) : [] };
  // stock de la boutique (comme le fait le serveur après paiement)
  if (isShop) saveDemoContent("products", demoContent<Product>("products").map((pr) => { const q = (p.body as { cart: CartLine[] }).cart.filter((l) => l.product_id === pr.id).reduce((s, l) => s + l.qty, 0);
    return q && pr.stock !== null ? { ...pr, stock: Math.max(0, pr.stock - q) } : pr; }));
  // confirmation dans la conversation du membre, avec le lien vers le reçu
  const c = demoChat();
  c.demo = [...(c.demo || []), { id: "k" + Date.now(), user_id: "demo", from_admin: true, kind: "text", created_at: new Date().toISOString(), read_at: null,
    body: confirmationText(o) }];
  saveDemoChat(c);
  write(K_DEMO_ORDERS, [o, ...(read<Order[]>(K_DEMO_ORDERS) || [])]);
  if (sub) write(K_DEMO_SUBS, [sub, ...(read<Subscription[]>(K_DEMO_SUBS) || [])]);
  try { localStorage.removeItem(K_DEMO_PENDING); } catch { /* mode privé */ }
  return o;
}

/* ───────── Dons mensuels du membre ───────── */
export async function listMySubscriptions(): Promise<Subscription[]> {
  if (!supabase) return read<Subscription[]>(K_DEMO_SUBS) || [];
  const { data, error } = await supabase.from("subscriptions").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Subscription[];
}
/** Espace client Stripe : arrêter un don mensuel, changer de carte, télécharger les reçus. */
export async function openPaymentPortal(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke("checkout", {
    body: { portal: true, return_url: Capacitor.isNativePlatform() ? import.meta.env.VITE_WEB_URL : window.location.origin + window.location.pathname } });
  if (error) throw error;
  return (data as { url: string }).url;
}
export function demoCancelSubscription(id: string) {
  write(K_DEMO_SUBS, (read<Subscription[]>(K_DEMO_SUBS) || []).map((x) => (x.id === id ? { ...x, status: "canceled", canceled_at: new Date().toISOString() } : x)));
}
export { K_DEMO_ORDERS, K_DEMO_SUBS };

/** Suppression du compte depuis l'appli : obligatoire pour l'App Store et le Play Store. */
export async function deleteAccount() {
  if (!supabase) { try { [K_DEMO_USER, K_DEMO_ORDERS, K_DEMO_ACCOUNT, "app.demo.subs", "app.demo.chat.v2"].forEach((k) => localStorage.removeItem(k)); } catch { /* mode privé */ } return; }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  await supabase.auth.signOut();
}

/* ───────── Contenus de la synagogue : cours, vidéos, galerie (tables Supabase, sinon exemples) ───────── */
export type Course = { id: string; title: string; rav: string; day: string; time: string; place: string; audience: string; description: string };
export type Video = { id: string; title: string; rav: string; youtube_id: string; published_at: string };
export type Photo = { id: string; url: string; caption: string; album: string; created_at?: string };
export type CourseRow = Course & { position?: number };

async function listTable<T>(table: ContentTable, order: string, asc = true): Promise<T[]> {
  if (!supabase) {
    const rows = demoContent<Record<string, unknown>>(table);
    return rows.sort((x, y) => (asc ? 1 : -1) * String(x[order] ?? "").localeCompare(String(y[order] ?? ""), undefined, { numeric: true })) as T[];
  }
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending: asc });
  if (error) throw error;
  return data as T[];
}
export const listCourses = () => listTable<Course>("courses", "position");
export const listVideos = () => listTable<Video>("videos", "published_at", false);
export const listPhotos = () => listTable<Photo>("gallery", "created_at", false);

/* ───────── Messagerie privée membre ⇄ administration ───────── */
export type ChatMessage = { id: string; user_id: string; from_admin: boolean; kind: "text" | "broadcast" | "reminder"; title?: string | null; body: string;
  amount_cents?: number | null; purpose?: string | null; created_at: string; read_at: string | null };
/** Démonstration : toutes les conversations de cet appareil (partagées entre le compte de démonstration et l'administration). */
export const DEMO_CHAT = "app.demo.chat.v2";
export const demoChat = () => read<Record<string, ChatMessage[]>>(DEMO_CHAT) || {};
export const saveDemoChat = (c: Record<string, ChatMessage[]>) => write(DEMO_CHAT, c);

export async function listChat(): Promise<ChatMessage[]> {
  if (!supabase) return demoChat()["demo"] || [];
  const { data, error } = await supabase.from("chat_messages").select("*").order("created_at").limit(1000);
  if (error) throw error;
  return data as ChatMessage[];
}
export async function sendChat(body: string) {
  const text = body.trim().slice(0, 4000);
  if (!text) return;
  if (!supabase) {
    const c = demoChat();
    c.demo = [...(c.demo || []), { id: "c" + Date.now(), user_id: "demo", from_admin: false, kind: "text", body: text, created_at: new Date().toISOString(), read_at: null }];
    saveDemoChat(c); return;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Connexion requise");
  const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, from_admin: false, kind: "text", body: text });
  if (error) throw error;
}
export async function markChatRead() {
  if (!supabase) { const c = demoChat(); c.demo = (c.demo || []).map((m) => (m.from_admin && !m.read_at ? { ...m, read_at: new Date().toISOString() } : m)); saveDemoChat(c); return; }
  await supabase.rpc("mark_chat_read");
}
export async function unreadCount(): Promise<number> {
  return (await listChat().catch(() => [])).filter((m) => m.from_admin && !m.read_at).length;
}

/** Texte envoyé au membre après chaque paiement (le serveur envoie le même, voir stripe-webhook). */
export function confirmationText(o: Pick<Order, "id" | "kind" | "label" | "total_cents" | "status">) {
  const what = o.kind === "shop" ? "votre achat (" + o.label + ")" : "votre don « " + o.label + " »";
  return (o.status === "processing" ? "Nous avons bien reçu " + what + " de " + euros(o.total_cents) + ". Le prélèvement sera confirmé par la banque d'ici quelques jours."
    : "Merci pour " + what + " de " + euros(o.total_cents) + ". Tizkou lemitsvot !") + " Votre reçu n° " + o.id.slice(0, 8).toUpperCase() + " est dans Compte › Mes commandes et dons.";
}

/** Une commande du membre connecté, avec ses lignes (pour le reçu). */
export async function getOrder(id: string): Promise<Order | null> {
  if (!supabase) return (read<Order[]>(K_DEMO_ORDERS) || []).find((o) => o.id === id) || null;
  const { data, error } = await supabase.from("orders").select("*, order_items(ref, name, qty, unit_cents, comment)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Order | null;
}

/* ───────── Fiche de l'association (reçus, reçus fiscaux, mentions légales) ───────── */
export type Association = { legal_name: string; address: string; postal_code: string; city: string; rna: string; siret: string; email: string; phone: string;
  object: string; president: string; tax_receipts: boolean; category: "cultuelle" | "interet_general" | "utilite_publique" };
export const EMPTY_ASSOCIATION: Association = { legal_name: "", address: "", postal_code: "", city: "", rna: "", siret: "", email: "", phone: "", object: "", president: "", tax_receipts: false, category: "cultuelle" };
const K_ASSO = "app.association";
export async function getAssociation(): Promise<Association> {
  if (!supabase) return { ...EMPTY_ASSOCIATION, ...(read<Association>(K_ASSO) || {}) };
  const { data } = await supabase.from("association").select("*").eq("id", 1).maybeSingle();
  const a = { ...EMPTY_ASSOCIATION, ...(data || {}) } as Association;
  write(K_ASSO, a);
  return a;
}
export const saveDemoAssociation = (a: Association) => write(K_ASSO, a);

/** Numéro du reçu fiscal d'un don : attribué une seule fois, à la suite (le serveur garantit la suite sans trou ni doublon). */
export async function taxReceiptNumber(orderId: string): Promise<number> {
  if (!supabase) {
    const map = read<Record<string, number>>("app.demo.taxno") || {};
    if (!map[orderId]) { map[orderId] = Object.keys(map).length + 1; write("app.demo.taxno", map); }
    return map[orderId];
  }
  const { data, error } = await supabase.rpc("tax_receipt_number", { order_id: orderId });
  if (error) throw error;
  return data as number;
}
