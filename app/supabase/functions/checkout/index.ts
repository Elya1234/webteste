// Supabase Edge Function « checkout » : crée la commande et la page de paiement Stripe.
// Le téléphone n'envoie que des identifiants et quantités : les prix viennent de la base.
// Moyens de paiement : ceux activés dans Stripe (Paramètres › Moyens de paiement) : carte, Apple Pay, Google Pay,
// prélèvement SEPA, Link… Aucun changement de code pour en ajouter ou en retirer.
// Secrets : STRIPE_SECRET_KEY, APP_RETURN_URLS. SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
import Stripe from "npm:stripe@22.6.2";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

type Line = { product_id: string; qty: number; comment?: string };
type Body = { cart?: Line[]; donation?: { amount_cents: number; purpose: string; dedication?: string; monthly?: boolean }; portal?: boolean; return_url?: string };

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

  // un seul client Stripe par membre : cartes enregistrées, dons mensuels, reçus au même nom
  const { data: prof } = await admin.from("profiles").select("stripe_customer_id, first_name, last_name, phone").eq("id", user.id).single();
  let customer = prof?.stripe_customer_id as string | undefined;
  if (!customer) {
    const c = await stripe.customers.create({ email: user.email, name: [prof?.first_name, prof?.last_name].filter(Boolean).join(" ") || undefined,
      phone: prof?.phone || undefined, metadata: { user_id: user.id } });
    customer = c.id;
    await admin.from("profiles").update({ stripe_customer_id: customer }).eq("id", user.id);
  }

  // espace client Stripe : le membre gère ses dons mensuels et ses cartes
  if (body.portal) {
    const s = await stripe.billingPortal.sessions.create({ customer, return_url: back + "#/compte", locale: "auto" });
    return json({ url: s.url });
  }

  let items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let order: { kind: "shop" | "donation"; label: string; total_cents: number; purpose?: string; dedication?: string };
  const rows: { product_id: string; ref: string; name: string; unit_cents: number; qty: number; comment: string }[] = [];
  let monthly = false;

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
    order = { kind: "shop", label: rows.reduce((s, r) => s + r.qty, 0) + " article(s)", total_cents: rows.reduce((s, r) => s + r.unit_cents * r.qty, 0) };
  } else if (body.donation) {
    const cents = Math.round(Number(body.donation.amount_cents));
    if (!(cents >= 100 && cents <= 10_000_000)) return json({ error: "Montant invalide" }, 400);
    const purpose = String(body.donation.purpose || "Don").slice(0, 80);
    const dedication = String(body.donation.dedication || "").slice(0, 200);
    monthly = !!body.donation.monthly;
    order = { kind: "donation", label: monthly ? purpose + " (mensuel)" : purpose, total_cents: cents, purpose, dedication };
    items = [{ quantity: 1, price_data: { currency: "eur", unit_amount: cents, ...(monthly ? { recurring: { interval: "month" as const } } : {}),
      product_data: { name: purpose + (monthly ? " · chaque mois" : ""), ...(dedication ? { description: dedication } : {}) } } }];
  } else return json({ error: "Rien à payer" }, 400);

  const { data: created, error: oe } = await admin.from("orders").insert({ ...order, user_id: user.id }).select("id").single();
  if (oe || !created) return json({ error: "Commande non créée" }, 500);
  if (rows.length) await admin.from("order_items").insert(rows.map((r) => ({ ...r, order_id: created.id })));

  const meta = { order_id: created.id, user_id: user.id, purpose: order.purpose || "", dedication: order.dedication || "" };
  const session = await stripe.checkout.sessions.create({
    mode: monthly ? "subscription" : "payment",
    customer,
    line_items: items,
    client_reference_id: created.id,
    metadata: meta,
    ...(monthly ? { subscription_data: { metadata: meta } }
      : { payment_intent_data: { metadata: meta, receipt_email: user.email }, customer_update: { name: "auto" } }),
    success_url: back + "#/compte?paiement=ok",
    cancel_url: back + "#/compte?paiement=annule",
    locale: "auto"
  });
  await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", created.id);
  return json({ url: session.url });
});
