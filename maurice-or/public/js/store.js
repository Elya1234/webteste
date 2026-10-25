// État partagé côté navigateur : cours, produits, utilisateur connecté, panier.
import { get } from './api.js';
import { unitPriceCents } from './shared/pricing.js';
import { track } from './track.js';

export const S = {
  prices: null,
  spot: null,
  products: [],
  byId: {},
  config: null,
  me: null,
};

const listeners = {};
export function on(evt, fn) { (listeners[evt] ||= new Set()).add(fn); return () => listeners[evt].delete(fn); }
export function emit(evt, data) { for (const fn of listeners[evt] || []) fn(data); }

export async function loadPrices() {
  try {
    S.prices = await get('/api/prices');
    S.spot = S.prices.available ? { eur: S.prices.oz } : null;
  } catch { /* on garde le dernier cours */ }
  emit('prices');
}

export async function loadProducts() {
  const { products } = await get('/api/products');
  S.products = products.sort((a, b) => a.sort - b.sort);
  S.byId = Object.fromEntries(products.map((p) => [p.id, p]));
  emit('products');
}

export async function loadConfig() {
  S.config = await get('/api/config');
}

export async function loadMe() {
  try { S.me = (await get('/api/auth/me')).user; } catch { S.me = null; }
  emit('me');
}

export function price(p, qty = 1) {
  if (!S.spot || !p) return null;
  return unitPriceCents(p, S.spot, qty);
}

// ---------- Panier (gardé dans le navigateur) ----------
const CART = 'mauriceor-cart';
export function getCart() {
  try {
    const c = JSON.parse(localStorage.getItem(CART)) || [];
    return c.filter((x) => S.byId[x.id] && x.qty > 0);
  } catch { return []; }
}
function saveCart(c) {
  try { localStorage.setItem(CART, JSON.stringify(c)); } catch { /* stockage plein ou bloqué */ }
  emit('cart');
}
export function addToCart(id, qty = 1) {
  const c = getCart();
  const line = c.find((x) => x.id === id);
  if (line) line.qty = Math.min(999, line.qty + qty);
  else c.push({ id, qty: Math.min(999, qty) });
  saveCart(c);
  track('cart_add', { id, qty, cart: c });
}
export function setCartQty(id, qty) {
  let c = getCart();
  if (qty <= 0) c = c.filter((x) => x.id !== id);
  else { const l = c.find((x) => x.id === id); if (l) l.qty = Math.min(999, qty); }
  saveCart(c);
  if (qty <= 0) track('cart_remove', { id, cart: c });
}
export function clearCart() { saveCart([]); }
export function cartCount() { return getCart().reduce((a, x) => a + x.qty, 0); }
