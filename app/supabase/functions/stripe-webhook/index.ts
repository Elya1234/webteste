// Supabase Edge Function « stripe-webhook » : Stripe prévient de chaque étape du paiement, la base se met à jour.
// Événements à cocher dans Stripe › Développeurs › Webhooks :
//   checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
//   checkout.session.expired, invoice.paid, customer.subscription.updated, customer.subscription.deleted, charge.refunded
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Déployer avec --no-verify-jwt (Stripe n'a pas de compte Supabase).
import Stripe from "npm:stripe@22.6.2";
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function paymentDetails(pi: string | Stripe.PaymentIntent | null | undefined) {
  if (!pi) return {};
  const intent = typeof pi === "string" ? await stripe.paymentIntents.retrieve(pi, { expand: ["latest_charge"] }) : pi;
  const charge = intent.latest_charge && typeof intent.latest_charge !== "string" ? intent.latest_charge : null;
  const wallet = charge?.payment_method_details?.card?.wallet?.type; // apple_pay, google_pay…
  return { stripe_payment_intent: intent.id, payment_method: wallet || charge?.payment_method_details?.type || intent.payment_method_types?.[0] || null,
    receipt_url: charge?.receipt_url || null };
}

// passage à « payé » une seule fois (Stripe peut renvoyer un événement) ; baisse du stock de la boutique
async function markPaid(orderId: string, extra: Record<string, unknown>) {
  const { data } = await admin.from("orders").update({ status: "paid", paid_at: new Date().toISOString(), ...extra })
    .eq("id", orderId).in("status", ["pending", "processing"]).select("id");
  if (!data?.length) return;
  const { data: lines } = await admin.from("order_items").select("product_id, qty").eq("order_id", orderId);
  for (const l of lines || []) {
    if (!l.product_id) continue;
    const { data: p } = await admin.from("products").select("stock").eq("id", l.product_id).single();
    if (p && p.stock !== null) await admin.from("products").update({ stock: Math.max(0, p.stock - l.qty) }).eq("id", l.product_id);
  }
}

Deno.serve(async (req) => {
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get("stripe-signature") || "", Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch {
    return new Response("signature invalide", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const s = event.data.object as Stripe.Checkout.Session;
      const orderId = s.metadata?.order_id;
      if (!orderId) break;
      if (event.type === "checkout.session.expired") { await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending"); break; }
      if (event.type === "checkout.session.async_payment_failed") { await admin.from("orders").update({ status: "failed" }).eq("id", orderId); break; }
      if (s.mode === "subscription" && s.subscription) {
        const sub = typeof s.subscription === "string" ? await stripe.subscriptions.retrieve(s.subscription) : s.subscription;
        await admin.from("subscriptions").upsert({ id: sub.id, user_id: s.metadata?.user_id || null, amount_cents: s.amount_total || 0,
          purpose: s.metadata?.purpose || "Don mensuel", dedication: s.metadata?.dedication || null, status: sub.status });
        await admin.from("orders").update({ stripe_subscription_id: sub.id }).eq("id", orderId);
        if (s.payment_status === "paid") await markPaid(orderId, {});
        break;
      }
      if (s.payment_status === "paid") await markPaid(orderId, await paymentDetails(s.payment_intent as string));
      else await admin.from("orders").update({ status: "processing", ...(await paymentDetails(s.payment_intent as string)) }).eq("id", orderId).eq("status", "pending");
      break;
    }
    case "invoice.paid": {
      // dons mensuels : la 1re échéance est la commande d'origine, chaque mois suivant crée une nouvelle ligne « payé »
      const inv = event.data.object as Stripe.Invoice & { subscription?: string };
      const subId = (inv.parent?.subscription_details?.subscription as string) || inv.subscription;
      if (!subId || inv.billing_reason === "subscription_create") break;
      const { data: sub } = await admin.from("subscriptions").select("*").eq("id", subId).maybeSingle();
      if (!sub) break;
      const { data: exists } = await admin.from("orders").select("id").eq("stripe_session_id", inv.id).maybeSingle();
      if (exists) break;
      await admin.from("orders").insert({ user_id: sub.user_id, kind: "donation", label: sub.purpose + " (mensuel)", status: "paid", total_cents: inv.amount_paid,
        purpose: sub.purpose, dedication: sub.dedication, stripe_session_id: inv.id, stripe_subscription_id: subId, paid_at: new Date().toISOString(),
        receipt_url: inv.hosted_invoice_url || null });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await admin.from("subscriptions").update({ status: sub.status, canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null }).eq("id", sub.id);
      break;
    }
    case "charge.refunded": {
      const ch = event.data.object as Stripe.Charge;
      const pi = typeof ch.payment_intent === "string" ? ch.payment_intent : ch.payment_intent?.id;
      if (pi) await admin.from("orders").update({ refunded_cents: ch.amount_refunded, ...(ch.refunded ? { status: "refunded" } : {}) }).eq("stripe_payment_intent", pi);
      break;
    }
  }
  return new Response("ok");
});
