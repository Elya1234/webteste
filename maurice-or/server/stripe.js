// Paiement par carte via Stripe Checkout (sans dépendance : appels HTTP directs).
// Activé seulement si STRIPE_SECRET_KEY est renseignée.
import crypto from 'node:crypto';

export function createStripe(secretKey) {
  if (!secretKey) return null;

  async function checkout({ amount, description, ref, kind, email, successUrl, cancelUrl }) {
    const form = new URLSearchParams({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      client_reference_id: ref,
      'metadata[ref]': ref,
      'metadata[kind]': kind,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][unit_amount]': String(amount),
      'line_items[0][price_data][product_data][name]': description,
      'payment_intent_data[metadata][ref]': ref,
    });
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Stripe indisponible');
    return { id: data.id, url: data.url };
  }

  // Vérifie la signature envoyée par Stripe (en-tête Stripe-Signature).
  function verifyWebhook(raw, header, secret) {
    if (!secret || !header) return null;
    const parts = Object.fromEntries(String(header).split(',').map((kv) => kv.split('=')));
    const t = Number(parts.t);
    if (!t || Math.abs(Date.now() / 1000 - t) > 300) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${t}.${raw.toString('utf8')}`).digest('hex');
    const given = String(header).split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
    const ok = given.some((g) => g.length === expected.length && crypto.timingSafeEqual(Buffer.from(g), Buffer.from(expected)));
    return ok ? JSON.parse(raw.toString('utf8')) : null;
  }

  return { checkout, verifyWebhook };
}
