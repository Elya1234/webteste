/* Comptes, boutique, commandes et dons.
 * - Avec VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY : vraie base Supabase + paiement Stripe (fonction « checkout »).
 * - Sans : mode démonstration, tout reste sur l'appareil et aucun paiement n'est encaissé. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { read, write } from "./storage";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabase: SupabaseClient | null = URL_ && KEY ? createClient(URL_, KEY) : null;
export const DEMO = !supabase;

export type Product = {
  id: string; ref: string; name: string; description: string; category: string;
  price_cents: number; image_url: string | null; stock: number | null;
  /** Si renseigné, l'acheteur doit écrire un commentaire (ex. « Nom pour la dédicace »). */
  comment_label: string | null; active: boolean;
};
export type Profile = { id: string; email: string; first_name: string; last_name: string; phone: string };
export type CartLine = { product_id: string; qty: number; comment: string };
export type Order = { id: string; created_at: string; status: "pending" | "paid" | "cancelled"; total_cents: number; kind: "shop" | "donation"; label: string };
export type DonationInput = { amount_cents: number; purpose: string; dedication: string };

export const euros = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/* ───────── Données de démonstration (remplacées par la table « products ») ───────── */
const DEMO_PRODUCTS: Product[] = [
  { id: "p1", ref: "SID-001", name: "Siddour Patah Eliyahou", description: "Rite séfarade, traduction et phonétique.", category: "Livres", price_cents: 2500, image_url: null, stock: 12, comment_label: null, active: true },
  { id: "p2", ref: "MAH-002", name: "Mahzor Roch Hachana – Kippour", description: "Édition complète, 2 volumes.", category: "Livres", price_cents: 4500, image_url: null, stock: 6, comment_label: null, active: true },
  { id: "p3", ref: "DED-010", name: "Dédicace d'un livre de la synagogue", description: "Une étiquette à votre nom (ou à la mémoire d'un proche) est collée dans un livre.", category: "Dédicaces", price_cents: 3600, image_url: null, stock: null, comment_label: "Nom à inscrire (Leilouy Nichmat, Refoua Chelema…)", active: true },
  { id: "p4", ref: "PLQ-020", name: "Plaque commémorative", description: "Plaque gravée posée au mur du souvenir.", category: "Dédicaces", price_cents: 18000, image_url: null, stock: null, comment_label: "Texte de la plaque (nom, nom du père / de la mère, date)", active: true },
  { id: "p5", ref: "KIP-030", name: "Kippa brodée", description: "Velours, broderie dorée.", category: "Objets", price_cents: 1200, image_url: null, stock: 30, comment_label: null, active: true },
  { id: "p6", ref: "BOU-040", name: "Bougies de Chabbat (boîte de 72)", description: "Durée 3 h 30.", category: "Objets", price_cents: 800, image_url: null, stock: 40, comment_label: null, active: true }
];

export async function listProducts(): Promise<Product[]> {
  if (!supabase) return DEMO_PRODUCTS;
  const { data, error } = await supabase.from("products").select("*").eq("active", true).order("category").order("name");
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
  return { id: user.id, email: user.email || "", first_name: data?.first_name || "", last_name: data?.last_name || "", phone: data?.phone || "" };
}

export async function signUp(email: string, password: string, info: Pick<Profile, "first_name" | "last_name" | "phone">) {
  if (!supabase) { const p = { id: "demo", email, ...info }; write(K_DEMO_USER, p); return { needsConfirmation: false }; }
  // le profil est créé par un déclencheur SQL à partir de ces métadonnées (voir supabase/schema.sql)
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: info } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string) {
  if (!supabase) { const p = read<Profile>(K_DEMO_USER) || { id: "demo", email, first_name: "", last_name: "", phone: "" }; write(K_DEMO_USER, { ...p, email }); return; }
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
  if (!supabase) { write(K_DEMO_USER, p); return; }
  const { error } = await supabase.from("profiles").update({ first_name: p.first_name, last_name: p.last_name, phone: p.phone }).eq("id", p.id);
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
  const { data, error } = await supabase.from("orders").select("id, created_at, status, total_cents, kind, label").order("created_at", { ascending: false });
  if (error) throw error;
  return data as Order[];
}

/** Lance le paiement. Les prix sont recalculés côté serveur : le téléphone n'envoie que les références et quantités. */
export async function checkout(body: { cart: CartLine[] } | { donation: DonationInput }): Promise<{ url?: string; demoOrder?: Order }> {
  if (!supabase) {
    const isShop = "cart" in body;
    const total = isShop
      ? body.cart.reduce((s, l) => s + (DEMO_PRODUCTS.find((p) => p.id === l.product_id)?.price_cents || 0) * l.qty, 0)
      : body.donation.amount_cents;
    const o: Order = { id: "D" + Date.now().toString(36).toUpperCase(), created_at: new Date().toISOString(), status: "paid", total_cents: total,
      kind: isShop ? "shop" : "donation", label: isShop ? body.cart.length + " article(s)" : body.donation.purpose };
    write(K_DEMO_ORDERS, [o, ...(read<Order[]>(K_DEMO_ORDERS) || [])]);
    return { demoOrder: o };
  }
  const { data, error } = await supabase.functions.invoke("checkout", {
    // appli iPhone/Android : Stripe s'ouvre dans le navigateur et revient sur la version web (VITE_WEB_URL)
    body: { ...body, return_url: Capacitor.isNativePlatform() ? import.meta.env.VITE_WEB_URL : window.location.origin + window.location.pathname }
  });
  if (error) throw error;
  return { url: (data as { url: string }).url };
}

/** Suppression du compte depuis l'appli : obligatoire pour l'App Store et le Play Store. */
export async function deleteAccount() {
  if (!supabase) { try { localStorage.removeItem(K_DEMO_USER); localStorage.removeItem(K_DEMO_ORDERS); } catch { /* mode privé */ } return; }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw error;
  await supabase.auth.signOut();
}

/* ───────── Contenus de la synagogue : cours, vidéos, galerie (tables Supabase, sinon exemples) ───────── */
export type Course = { id: string; title: string; rav: string; day: string; time: string; place: string; audience: string; description: string };
export type Video = { id: string; title: string; rav: string; youtube_id: string; published_at: string };
export type Photo = { id: string; url: string; caption: string; album: string };

const DEMO_COURSES: Course[] = [
  { id: "c1", title: "Guemara", rav: "Le Rav", day: "Dimanche", time: "09:30", place: "Grande salle", audience: "Hommes", description: "Étude suivie du traité de la semaine." },
  { id: "c2", title: "Halakha au quotidien", rav: "Le Rav", day: "Lundi", time: "20:30", place: "Beth Hamidrach", audience: "Tous", description: "Les lois pratiques selon Maran." },
  { id: "c3", title: "Paracha de la semaine", rav: "Le Rav", day: "Mercredi", time: "20:45", place: "Grande salle", audience: "Tous", description: "Lecture et commentaires." },
  { id: "c4", title: "Cours pour les femmes", rav: "La Rabbanite", day: "Jeudi", time: "14:00", place: "Salle des fêtes", audience: "Femmes", description: "Hilkhot Chabbat et Tsniout." },
  { id: "c5", title: "Chiour avant Minha", rav: "Le Rav", day: "Chabbat", time: "Avant Minha", place: "Grande salle", audience: "Tous", description: "" }
];
const DEMO_VIDEOS: Video[] = [];
const DEMO_PHOTOS: Photo[] = [{ id: "g1", url: "synagogue-bg.jpg", caption: "La synagogue", album: "La synagogue" }];

async function listTable<T>(table: string, order: string, demo: T[], asc = true): Promise<T[]> {
  if (!supabase) return demo;
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending: asc });
  if (error) throw error;
  return data as T[];
}
export const listCourses = () => listTable<Course>("courses", "position", DEMO_COURSES);
export const listVideos = () => listTable<Video>("videos", "published_at", DEMO_VIDEOS, false);
export const listPhotos = () => listTable<Photo>("gallery", "created_at", DEMO_PHOTOS, false);

/* ───────── Messages reçus de l'administration ───────── */
export type InboxMessage = { id: string; created_at: string; title: string; body: string; read_at: string | null };
export async function listInbox(): Promise<InboxMessage[]> {
  if (!supabase) return read<InboxMessage[]>("app.demo.inbox") || [];
  const { data, error } = await supabase.from("message_recipients").select("read_at, messages(id, created_at, title, body)").order("message_id");
  if (error) throw error;
  type Row = { read_at: string | null; messages: { id: string; created_at: string; title: string; body: string } | null };
  return ((data || []) as unknown as Row[]).filter((r) => r.messages).map((r) => ({ ...r.messages!, read_at: r.read_at }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
export async function markRead(id: string) {
  if (!supabase) { write("app.demo.inbox", (read<InboxMessage[]>("app.demo.inbox") || []).map((m) => (m.id === id ? { ...m, read_at: m.read_at || new Date().toISOString() } : m))); return; }
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("message_recipients").update({ read_at: new Date().toISOString() }).eq("message_id", id).eq("user_id", user.id).is("read_at", null);
}
