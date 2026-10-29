// Supabase Edge Function « checkout » : crée la commande et la page de paiement Stripe.
// Le téléphone n'envoie que des identifiants et quantités : les prix viennent de la base.
// Secrets (supabase secrets set …) : STRIPE_SECRET_KEY. SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
import Stripe from "npm:stripe@22.6.2";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Line = { product_id: string; qty: number; comment?: string };
type Body = { cart?: Line[]; donation?: { amount_cents: number; purpose: string; dedication?: string }; return_url?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: "Connexion requise" }, 401);

  const body = (await req.json().catch(() => ({}))) as Body;
  // retour dans l'appli après paiement ; seules les adresses connues sont acceptées
  const allowed = (Deno.env.get("APP_RETURN_URLS") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const back = body.return_url && allowed.includes(body.return_url) ? body.return_url : allowed[0];
  if (!back) return json({ error: "APP_RETURN_URLS non configuré" }, 500);

  let items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let order: { kind: "shop" | "donation"; label: string; total_cents: number; purpose?: string; dedication?: string };
  let rows: { product_id: string; ref: string; name: string; unit_cents: number; qty: number; comment: string }[] = [];

  if (body.cart?.length) {
    const ids = [...new Set(body.cart.map((l) => l.product_id))];
    const { data: products, error } = await admin.from("products").select("*").in("id", ids).eq("active", true);
    if (error || !products) return json({ error: "Articles introuvables" }, 400);
    for (const l of body.cart) {
      const p = products.find((x) => x.id === l.product_id);
      const qty = Math.floor(Number(l.qty));
      const comment = String(l.comment || "").slice(0, 300).trim();
      if (!p || !(qty >= 1 && qty <= 99)) return json({ error: "Panier invalide" }, 400);
      if (p.comment_label && !comment) return json({ error: "Commentaire manquant pour " + p.ref }, 400);
      if (p.stock !== null && p.stock < qty) return json({ error: "Stock insuffisant pour " + p.ref }, 409);
      rows.push({ product_id: p.id, ref: p.ref, name: p.name, unit_cents: p.price_cents, qty, comment });
      items.push({ quantity: qty, price_data: { currency: "eur", unit_amount: p.price_cents,
        product_data: { name: p.name + " (réf. " + p.ref + ")", ...(comment ? { description: comment } : {}) } } });
    }
    const total = rows.reduce((s, r) => s + r.unit_cents * r.qty, 0);
    order = { kind: "shop", label: rows.reduce((s, r) => s + r.qty, 0) + " article(s)", total_cents: total };
  } else if (body.donation) {
    const cents = Math.round(Number(body.donation.amount_cents));
    if (!(cents >= 100 && cents <= 10_000_000)) return json({ error: "Montant invalide" }, 400);
    const purpose = String(body.donation.purpose || "Don").slice(0, 80);
    const dedication = String(body.donation.dedication || "").slice(0, 200);
    order = { kind: "donation", label: purpose, total_cents: cents, purpose, dedication };
    items = [{ quantity: 1, price_data: { currency: "eur", unit_amount: cents, product_data: { name: purpose, ...(dedication ? { description: dedication } : {}) } } }];
  } else return json({ error: "Rien à payer" }, 400);

  const { data: created, error: oe } = await admin.from("orders").insert({ ...order, user_id: user.id }).select("id").single();
  if (oe || !created) return json({ error: "Commande non créée" }, 500);
  if (rows.length) await admin.from("order_items").insert(rows.map((r) => ({ ...r, order_id: created.id })));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: items,
    customer_email: user.email,
    client_reference_id: created.id,
    metadata: { order_id: created.id },
    success_url: back + "#/compte?paiement=ok",
    cancel_url: back + "#/compte?paiement=annule",
    locale: "fr"
  });
  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", created.id);
  return json({ url: session.url });
});
