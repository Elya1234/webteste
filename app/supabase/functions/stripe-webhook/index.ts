// Supabase Edge Function « stripe-webhook » : Stripe confirme le paiement → la commande passe « Payé » et le stock baisse.
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Déployer avec --no-verify-jwt (Stripe n'a pas de compte Supabase).
import Stripe from "npm:stripe@22.6.2";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get("stripe-signature") || "", Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch {
    return new Response("signature invalide", { status: 400 });
  }
  const s = event.data.object as Stripe.Checkout.Session;
  const orderId = s.metadata?.order_id;
  if (!orderId) return new Response("ok");

  if (event.type === "checkout.session.completed" && s.payment_status === "paid") {
    // n'agit qu'une fois, même si Stripe renvoie l'événement
    const { data } = await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId).eq("status", "pending").select("id");
    if (data?.length) {
      const { data: lines } = await admin.from("order_items").select("product_id, qty").eq("order_id", orderId);
      for (const l of lines || []) {
        if (!l.product_id) continue;
        const { data: p } = await admin.from("products").select("stock").eq("id", l.product_id).single();
        if (p && p.stock !== null) await admin.from("products").update({ stock: Math.max(0, p.stock - l.qty) }).eq("id", l.product_id);
      }
    }
  } else if (event.type === "checkout.session.expired") {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
  }
  return new Response("ok");
});
