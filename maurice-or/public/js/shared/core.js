// Logique métier de Maurice Or : comptes, portefeuille or, demandes validées par
// l'administrateur, commandes, suivi de l'activité des clients, administration.
// Ce module tourne tel quel sur le serveur (Node) et, en mode démo, dans le
// navigateur. Les dépendances techniques (hachage, aléatoire, paiement carte)
// sont fournies par l'hôte.
import { PRODUCTS } from './catalog.js';
import {
  DEFAULT_SETTINGS, unitPriceCents, tierTable, metalValueCents, buybackCents,
  gramBuyCents, gramSellCents, shippingCents, badgeOf, perGram, eur,
} from './pricing.js';

const DAY = 86400000;
const SESSION_IDLE = 4 * 3600000;
const SESSION_MAX = 7 * DAY;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EVENTS = 30000;
const ONLINE_MS = 5 * 60000;

export const ORDER_STATUS = {
  a_valider: 'En attente de validation',
  en_attente_paiement: 'Validée – en attente de paiement',
  payee: 'Payée',
  preparation: 'En préparation',
  expediee: 'Expédiée',
  prete_retrait: 'Prête à retirer en boutique',
  livree: 'Livrée',
  au_coffre: 'Au coffre',
  annulee: 'Annulée',
  refusee: 'Refusée',
  expiree: 'Expirée',
};

export const REQUEST_STATUS = {
  en_attente: 'En attente de validation',
  validee: 'Validée',
  refusee: 'Refusée',
  expiree: 'Expirée',
  annulee: 'Annulée',
};

export const REQUEST_KIND = {
  buy_gold: 'Achat d\'or au gramme',
  sell_gold: 'Vente d\'or au gramme',
  buy_product: 'Achat au coffre',
  sell_product: 'Revente du coffre',
};

// Actions que le navigateur peut signaler pour le suivi de l'activité.
const TRACK_TYPES = ['page', 'product_view', 'cart_add', 'cart_remove', 'checkout_start', 'trade_open', 'trade_cancel', 'whatsapp'];
const INTENT_TYPES = ['cart_add', 'checkout_start', 'trade_open'];
const DONE_TYPES = ['order_created', 'request_created', 'trade_done'];

export function emptyState() {
  return {
    version: 2,
    seq: { user: 0, order: 0, ledger: 0, deposit: 0, withdrawal: 0, message: 0, request: 0, event: 0, notif: 0 },
    users: {},
    emailIndex: {},
    sessions: {},
    productOverrides: {},
    settings: {},
    ledger: [],
    vault: {},
    orders: [],
    deposits: [],
    withdrawals: [],
    messages: [],
    requests: [],
    events: [],
    visitors: {},
  };
}

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

// ---------- TOTP (double authentification) ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function base32Decode(str) {
  let bits = 0, value = 0; const out = [];
  for (const c of str.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(c); if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
async function totpAt(deps, secret, counter) {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
  const h = await deps.hmacSha1(base32Decode(secret), msg);
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}
async function verifyTotp(deps, secret, code) {
  code = String(code || '').replace(/\s/g, '');
  if (!secret || !/^\d{6}$/.test(code)) return false;
  const step = Math.floor(deps.now() / 30000);
  for (const d of [-1, 0, 1]) if (await totpAt(deps, secret, step + d) === code) return true;
  return false;
}

// ---------- Validation ----------
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
function positiveNumber(v, label) {
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) fail(400, `${label} invalide.`);
  return n;
}
function intQty(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 999) fail(400, 'Quantité invalide.');
  return n;
}
function normalizeIban(v) {
  const iban = str(v, 60).replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) fail(400, 'IBAN invalide.');
  // Contrôle de clé ISO 13616 (modulo 97)
  const r = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let m = 0;
  for (const ch of r) m = (m * 10 + Number(ch)) % 97;
  if (m !== 1) fail(400, 'IBAN invalide (clé de contrôle).');
  return iban;
}
const gtxt = (mg) => (mg / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 }) + ' g';

export function createCore({ state, save, deps, getSpot, getHistory = () => [], instantPayments = false }) {
  // anciennes données (version 1) : on complète ce qui manque
  for (const [k, v] of Object.entries(emptyState())) if (state[k] === undefined) state[k] = v;
  for (const k of Object.keys(emptyState().seq)) state.seq[k] ??= 0;

  const rate = new Map();
  const S = () => ({ ...DEFAULT_SETTINGS, ...state.settings });
  const now = () => deps.now();
  const iso = () => new Date(now()).toISOString();

  // ---------- Produits ----------
  function product(id) {
    const base = PRODUCTS.find((p) => p.id === id);
    if (!base) return null;
    return { ...base, ...(state.productOverrides[id] || {}) };
  }
  function allProducts() {
    return PRODUCTS.map((p) => product(p.id));
  }
  function publicProduct(p, spot) {
    return {
      ...p,
      price: unitPriceCents(p, spot, 1),
      tiers: tierTable(p, spot),
      metalValue: metalValueCents(p, spot),
      buyback: buybackCents(p, spot, S()),
      badge: badgeOf(p),
    };
  }
  function setOverride(id, patch) {
    state.productOverrides[id] = { ...(state.productOverrides[id] || {}), ...patch };
  }

  // ---------- Cours ----------
  function liveSpot() {
    const spot = getSpot();
    const s = S();
    if (!spot || !spot.eur || !spot.eur.or) fail(503, 'Cours de l\'or indisponible pour le moment. Réessayez dans un instant.');
    if (spot.manual) return spot;
    if (now() - spot.updatedAt > s.staleAfterMin * 60000) {
      fail(503, 'Le cours n\'a pas pu être mis à jour récemment : les transactions sont suspendues par sécurité. Réessayez dans quelques minutes.');
    }
    return spot;
  }
  function displaySpot() {
    try { return getSpot(); } catch { return null; }
  }
  function checkMove(current, expected, direction) {
    if (expected == null) return;
    const e = Number(expected);
    if (!Number.isFinite(e) || e <= 0) return;
    const tol = S().maxPriceMove;
    const worse = direction === 'buy' ? current > e * (1 + tol) : current < e * (1 - tol);
    if (worse) fail(409, `Le cours a bougé : le nouveau prix est ${eur(current)}. Vérifiez et validez à nouveau.`, { price: current });
  }

  // ---------- Limitation des tentatives ----------
  function limit(key, max, windowMs) {
    const t = now();
    const r = rate.get(key);
    if (!r || r.reset < t) { rate.set(key, { count: 1, reset: t + windowMs }); return; }
    r.count++;
    if (r.count > max) fail(429, 'Trop de tentatives. Patientez quelques minutes avant de réessayer.');
  }

  // ---------- Journal d'activité (visible par l'administrateur) ----------
  function ev(type, user, label, data = {}, visitor = null) {
    state.seq.event++;
    state.events.push({ id: state.seq.event, at: iso(), t: now(), type, userId: user ? user.id : null, visitor: visitor || null, label, data });
    if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS);
  }
  function notify(user, text, link = null) {
    if (!user) return;
    state.seq.notif++;
    user.notifs = user.notifs || [];
    user.notifs.unshift({ id: state.seq.notif, at: iso(), text, link, read: false });
    user.notifs.length = Math.min(user.notifs.length, 50);
  }

  // ---------- Sessions ----------
  async function openSession(user) {
    const token = deps.randomToken(32);
    const key = await deps.sha256(token);
    state.sessions[key] = { userId: user.id, csrf: deps.randomToken(16), createdAt: now(), lastSeen: now() };
    for (const [k, s] of Object.entries(state.sessions)) {
      if (now() - s.lastSeen > SESSION_IDLE || now() - s.createdAt > SESSION_MAX) delete state.sessions[k];
    }
    return token;
  }
  async function sessionFrom(token) {
    if (!token || typeof token !== 'string' || token.length > 200) return null;
    const key = await deps.sha256(token);
    const s = state.sessions[key];
    if (!s) return null;
    if (now() - s.lastSeen > SESSION_IDLE || now() - s.createdAt > SESSION_MAX) {
      delete state.sessions[key]; save(); return null;
    }
    const user = state.users[s.userId];
    if (!user) return null;
    s.lastSeen = now();
    user.lastSeen = now();
    return { key, session: s, user };
  }

  function publicUser(u, csrf) {
    return {
      id: u.id, clientNo: u.clientNo, email: u.email, firstName: u.firstName, lastName: u.lastName,
      phone: u.phone, address: u.address, zip: u.zip, city: u.city, country: u.country,
      role: u.role, totpEnabled: !!u.totpEnabled, createdAt: u.createdAt, csrf,
    };
  }

  function addLedger(user, entry) {
    state.seq.ledger++;
    state.ledger.push({ id: state.seq.ledger, userId: user.id, at: iso(), cashAfter: user.cash, goldAfter: user.goldMg, ...entry });
  }

  function vaultOf(userId) {
    return state.vault[userId] || (state.vault[userId] = {});
  }

  function makeRef(prefix, n) {
    const rnd = deps.randomToken(3).toUpperCase();
    return `${prefix}-${String(n).padStart(5, '0')}-${rnd}`;
  }

  function linkVisitor(user, visitor) {
    visitor = str(visitor, 40);
    if (!visitor) return;
    for (const e of state.events) if (e.visitor === visitor && !e.userId) e.userId = user.id;
    const v = state.visitors[visitor];
    if (v && v.cart && v.cart.length && !(user.cart && user.cart.length)) user.cart = v.cart;
    delete state.visitors[visitor];
  }

  // ---------- Demandes (validées par l'administrateur) ----------
  const needsApproval = (kind) => (kind.startsWith('buy') ? S().approvalBuy : S().approvalSell);

  function createRequest(u, data) {
    state.seq.request++;
    const req = {
      id: state.seq.request, ref: makeRef('DEM', state.seq.request), userId: u.id, status: 'en_attente',
      createdAt: iso(), expiresAt: new Date(now() + S().approvalWindowMin * 60000).toISOString(), ...data,
    };
    state.requests.push(req);
    ev('request_created', u, `Demande ${req.ref} : ${req.label} (${eur(req.amount)})`, { ref: req.ref, amount: req.amount });
    return req;
  }

  // Exécution réelle d'une opération (immédiate, ou à la validation de l'admin).
  function execute(u, op, fromHold) {
    const v = vaultOf(u.id);
    if (op.kind === 'buy_gold') {
      if (fromHold) u.held -= op.amount; else u.cash -= op.amount;
      u.goldMg += op.mg;
      addLedger(u, { type: 'achat_or', label: `Achat de ${gtxt(op.mg)} d'or à ${eur(op.unit)}/g`, amount: -op.amount, goldMg: op.mg, unit: op.unit, ref: op.ref });
    } else if (op.kind === 'sell_gold') {
      if (fromHold) u.heldMg -= op.mg; else u.goldMg -= op.mg;
      u.cash += op.amount;
      addLedger(u, { type: 'vente_or', label: `Vente de ${gtxt(op.mg)} d'or à ${eur(op.unit)}/g`, amount: op.amount, goldMg: -op.mg, unit: op.unit, ref: op.ref });
    } else if (op.kind === 'buy_product') {
      if (fromHold) u.held -= op.amount;
      else { u.cash -= op.amount; setOverride(op.productId, { stock: product(op.productId).stock - op.qty }); }
      v[op.productId] = (v[op.productId] || 0) + op.qty;
      addLedger(u, { type: 'achat_produit', label: `Achat ${op.qty} × ${op.name} (gardé au coffre)`, amount: -op.amount, productId: op.productId, qty: op.qty, unit: op.unit, ref: op.ref });
    } else if (op.kind === 'sell_product') {
      if (!fromHold) v[op.productId] -= op.qty;
      u.cash += op.amount;
      setOverride(op.productId, { stock: (product(op.productId).stock || 0) + op.qty });
      addLedger(u, { type: 'vente_produit', label: `Revente ${op.qty} × ${op.name}`, amount: op.amount, productId: op.productId, qty: op.qty, unit: op.unit, ref: op.ref });
    }
  }

  // Met de côté l'argent / l'or concerné pendant l'attente de validation.
  function hold(u, op) {
    if (op.kind === 'buy_gold') { u.cash -= op.amount; u.held = (u.held || 0) + op.amount; }
    if (op.kind === 'sell_gold') { u.goldMg -= op.mg; u.heldMg = (u.heldMg || 0) + op.mg; }
    if (op.kind === 'buy_product') { u.cash -= op.amount; u.held = (u.held || 0) + op.amount; setOverride(op.productId, { stock: product(op.productId).stock - op.qty }); }
    if (op.kind === 'sell_product') { vaultOf(u.id)[op.productId] -= op.qty; }
  }
  function release(u, op) {
    if (op.kind === 'buy_gold') { u.held -= op.amount; u.cash += op.amount; }
    if (op.kind === 'sell_gold') { u.heldMg -= op.mg; u.goldMg += op.mg; }
    if (op.kind === 'buy_product') { u.held -= op.amount; u.cash += op.amount; setOverride(op.productId, { stock: (product(op.productId).stock || 0) + op.qty }); }
    if (op.kind === 'sell_product') { const v = vaultOf(u.id); v[op.productId] = (v[op.productId] || 0) + op.qty; }
  }

  function trade(u, op) {
    if (needsApproval(op.kind)) {
      hold(u, op);
      const req = createRequest(u, op);
      save();
      return { pending: true, request: req };
    }
    execute(u, op, false);
    ev('trade_done', u, `${REQUEST_KIND[op.kind]} : ${op.label} (${eur(op.amount)})`, { amount: op.amount });
    save();
    return { pending: false, ...op };
  }

  function closeRequest(req, status, note, admin) {
    const u = state.users[req.userId];
    req.status = status; req.decidedAt = iso(); req.note = note || null; req.decidedBy = admin ? admin.clientNo : null;
    if (status === 'validee') {
      execute(u, req, true);
      notify(u, `Votre demande ${req.ref} est validée : ${req.label}.`, '#/espace/operations');
      ev('request_approved', u, `Demande ${req.ref} validée${admin ? ` par ${admin.firstName}` : ''}`, { ref: req.ref });
    } else {
      release(u, req);
      const why = { refusee: 'refusée', expiree: 'expirée (délai dépassé)', annulee: 'annulée' }[status];
      if (status !== 'annulee') notify(u, `Votre demande ${req.ref} a été ${why}${note ? ` : ${note}` : ''}. Les fonds sont de nouveau disponibles.`, '#/espace/operations');
      ev('request_' + status, u, `Demande ${req.ref} ${why}${note ? ` (${note})` : ''}`, { ref: req.ref });
    }
  }

  // ---------- Commandes ----------
  function applyPaid(order, via) {
    if (order.paidAt) return;
    order.paidAt = iso();
    order.paidVia = via;
    const user = state.users[order.userId];
    if (order.delivery === 'coffre') {
      const v = vaultOf(order.userId);
      for (const it of order.items) v[it.id] = (v[it.id] || 0) + it.qty;
      order.status = 'au_coffre';
      if (user) addLedger(user, { type: 'coffre_entree', label: `Commande ${order.ref} placée au coffre`, amount: 0, ref: order.ref });
    } else {
      order.status = 'preparation';
    }
    order.updatedAt = iso();
    notify(user, `Paiement reçu pour la commande ${order.ref}.`, `#/commande/${order.ref}`);
  }

  function cancelOrder(order, finalStatus = 'annulee') {
    if (['annulee', 'refusee', 'expiree'].includes(order.status)) return;
    const user = state.users[order.userId];
    if (order.paidAt && order.delivery === 'coffre') {
      const v = vaultOf(order.userId);
      for (const it of order.items) {
        if ((v[it.id] || 0) < it.qty) fail(400, 'Les produits ne sont plus au coffre du client : annulation impossible.');
      }
      for (const it of order.items) v[it.id] -= it.qty;
    }
    if (order.kind !== 'coffre') {
      for (const it of order.items) {
        const p = product(it.id);
        if (p) setOverride(it.id, { stock: (p.stock || 0) + it.qty });
      }
    }
    if (order.status === 'a_valider' && order.payment === 'solde' && user) {
      user.held -= order.total; user.cash += order.total;
    }
    if (order.paidAt && user && (order.paidVia === 'solde' || order.paidVia === 'carte')) {
      user.cash += order.total;
      addLedger(user, { type: 'remboursement', label: `Remboursement commande ${order.ref}`, amount: order.total, ref: order.ref });
    }
    if (order.kind === 'coffre' && user) {
      const v = vaultOf(order.userId);
      for (const it of order.items) v[it.id] = (v[it.id] || 0) + it.qty;
    }
    order.status = finalStatus;
    order.updatedAt = iso();
  }

  function validateAddress(a) {
    const addr = {
      name: str(a?.name, 120), address: str(a?.address, 200), zip: str(a?.zip, 12),
      city: str(a?.city, 80), country: str(a?.country || 'France', 60), phone: str(a?.phone, 30),
    };
    if (!addr.name || !addr.address || !addr.zip || !addr.city) fail(400, 'Adresse de livraison incomplète.');
    return addr;
  }

  // Les demandes et commandes non validées à temps expirent et libèrent les fonds.
  let lastSweep = 0;
  function sweep() {
    if (now() - lastSweep < 20000) return;
    lastSweep = now();
    let changed = false;
    for (const r of state.requests) {
      if (r.status === 'en_attente' && Date.parse(r.expiresAt) < now()) { closeRequest(r, 'expiree'); changed = true; }
    }
    for (const o of state.orders) {
      if (o.status === 'a_valider' && o.expiresAt && Date.parse(o.expiresAt) < now()) {
        cancelOrder(o, 'expiree');
        notify(state.users[o.userId], `La commande ${o.ref} n'a pas pu être validée à temps et a expiré. Les fonds réservés sont disponibles.`, `#/commande/${o.ref}`);
        ev('order_expired', state.users[o.userId], `Commande ${o.ref} expirée sans validation`, { ref: o.ref });
        changed = true;
      }
    }
    if (changed) save();
  }

  function cartValue(cart) {
    const spot = displaySpot();
    if (!spot || !spot.eur || !Array.isArray(cart)) return 0;
    return cart.reduce((a, l) => { const p = product(l.id); return p ? a + unitPriceCents(p, spot, l.qty) * l.qty : a; }, 0);
  }
  function cartLines(cart) {
    return (Array.isArray(cart) ? cart : []).map((l) => ({ id: l.id, qty: l.qty, name: product(l.id)?.name || l.id }));
  }

  // Ce que chaque client (ou visiteur) était en train de faire sans aller au bout.
  function intentions() {
    const lastIntent = new Map(), lastDone = new Map();
    for (const e of state.events) {
      const who = e.userId ? 'u' + e.userId : e.visitor ? 'v' + e.visitor : null;
      if (!who) continue;
      if (INTENT_TYPES.includes(e.type)) lastIntent.set(who, e);
      if (DONE_TYPES.includes(e.type)) lastDone.set(who, e);
    }
    const out = [];
    for (const [who, e] of lastIntent) {
      const done = lastDone.get(who);
      if (done && done.t >= e.t) continue;
      if (now() - e.t < 10 * 60000) continue; // encore peut-être en train de faire
      const u = who[0] === 'u' ? state.users[who.slice(1)] : null;
      const v = who[0] === 'v' ? state.visitors[who.slice(1)] : null;
      const cart = u ? u.cart : v ? v.cart : null;
      out.push({
        who: u ? `${u.firstName} ${u.lastName} (${u.clientNo})` : 'Visiteur anonyme',
        userId: u ? u.id : null, phone: u ? u.phone : null,
        label: e.label, at: e.at, type: e.type,
        cart: cartLines(cart), cartValue: cartValue(cart),
        lastSeen: u?.lastSeen ? new Date(u.lastSeen).toISOString() : v?.lastSeen ? new Date(v.lastSeen).toISOString() : e.at,
      });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 200);
  }

  function accountView(u, csrf) {
    const spot = displaySpot();
    const v = vaultOf(u.id);
    const vault = Object.entries(v).filter(([, q]) => q > 0).map(([id, qty]) => {
      const p = product(id);
      const pp = spot && spot.eur ? publicProduct(p, spot) : p;
      return { product: pp, qty, value: pp.metalValue ? pp.metalValue * qty : 0, buyback: pp.buyback ? pp.buyback * qty : 0 };
    });
    const vaultGoldMg = vault.filter((x) => x.product.metal === 'or').reduce((a, x) => a + Math.round(x.product.fine * 1000) * x.qty, 0);
    const gram = spot && spot.eur ? perGram(spot, 'or') : 0;
    const goldValue = Math.round(u.goldMg / 1000 * gram * 100);
    const vaultValue = vault.reduce((a, x) => a + x.value, 0);
    const heldGoldValue = Math.round((u.heldMg || 0) / 1000 * gram * 100);
    return {
      user: publicUser(u, csrf),
      cash: u.cash,
      held: u.held || 0,
      heldMg: u.heldMg || 0,
      goldMg: u.goldMg,
      goldValue,
      vault,
      vaultGoldMg,
      vaultValue,
      totalGoldMg: u.goldMg + (u.heldMg || 0) + vaultGoldMg,
      totalGoldValue: Math.round((u.goldMg + (u.heldMg || 0) + vaultGoldMg) / 1000 * gram * 100),
      total: u.cash + (u.held || 0) + goldValue + heldGoldValue + vaultValue,
      ledger: state.ledger.filter((l) => l.userId === u.id).slice(-200).reverse(),
      orders: state.orders.filter((o) => o.userId === u.id).slice().reverse(),
      deposits: state.deposits.filter((d) => d.userId === u.id).slice().reverse(),
      withdrawals: state.withdrawals.filter((w) => w.userId === u.id).slice().reverse(),
      requests: state.requests.filter((r) => r.userId === u.id).slice().reverse(),
      notifs: (u.notifs || []).slice(0, 30),
    };
  }

  // ---------- Routes ----------
  const routes = [];
  const route = (method, pattern, opts, fn) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, fn, ...opts });
  };

  route('GET', '/api/health', {}, () => ({ ok: true }));

  route('GET', '/api/prices', {}, () => {
    const spot = displaySpot();
    const s = S();
    const stale = !spot || !spot.eur || (!spot.manual && now() - spot.updatedAt > s.staleAfterMin * 60000);
    if (!spot || !spot.eur) return { available: false };
    return {
      available: true,
      stale,
      manual: !!spot.manual,
      updatedAt: spot.updatedAt,
      changePct: spot.changePct ?? null,
      oz: spot.eur,
      gram: {
        eur: { or: perGram(spot, 'or', 'eur'), argent: perGram(spot, 'argent', 'eur'), platine: perGram(spot, 'platine', 'eur') },
        gbp: { or: perGram(spot, 'or', 'gbp') },
        usd: { or: perGram(spot, 'or', 'usd') },
      },
      kilo: { or: perGram(spot, 'or', 'eur') * 1000 },
      gramBuy: gramBuyCents(spot, s),
      gramSell: gramSellCents(spot, s),
      history: getHistory(),
    };
  });

  route('GET', '/api/products', {}, () => {
    const spot = displaySpot();
    if (!spot || !spot.eur) return { products: allProducts().filter((p) => p.active).map((p) => ({ ...p, badge: badgeOf(p) })) };
    return { products: allProducts().filter((p) => p.active).map((p) => publicProduct(p, spot)) };
  });

  route('GET', '/api/config', {}, () => {
    const s = S();
    return {
      shopName: s.shopName, shopAddress: s.shopAddress, shopHours: s.shopHours, shopPhone: s.shopPhone,
      shopEmail: s.shopEmail, whatsapp: s.whatsapp, shippingFee: s.shippingFee, freeShippingFrom: s.freeShippingFrom,
      gramBuySpread: s.gramBuySpread, gramSellSpread: s.gramSellSpread, buybackSpread: s.buybackSpread,
      minGramTrade: s.minGramTrade, maxPriceMove: s.maxPriceMove, approvalBuy: s.approvalBuy, approvalSell: s.approvalSell,
      approvalWindowMin: s.approvalWindowMin, cardEnabled: !!deps.stripe || instantPayments, demo: instantPayments,
    };
  });

  // --- Suivi d'activité envoyé par le navigateur ---
  route('POST', '/api/track', {}, ({ body, auth, ip }) => {
    limit('track:' + ip, 600, 3600000);
    const type = String(body.type || '');
    if (!TRACK_TYPES.includes(type)) fail(400, 'Type inconnu.');
    const d = body.data && typeof body.data === 'object' ? body.data : {};
    const visitor = auth ? null : str(body.visitor, 40) || null;
    const u = auth ? auth.user : null;
    if (!u && !visitor) return { ok: true };
    const p = d.id ? product(str(d.id, 80)) : null;
    const qty = Math.max(0, Math.min(999, parseInt(d.qty, 10) || 0));
    const amount = Math.max(0, Math.min(1e10, Math.round(Number(d.amount) || 0)));
    const path = str(d.path, 80);
    let cart = null;
    if (Array.isArray(d.cart)) cart = d.cart.slice(0, 50).map((l) => ({ id: str(l.id, 80), qty: Math.max(1, Math.min(999, parseInt(l.qty, 10) || 1)) })).filter((l) => product(l.id));
    const label = {
      page: `Consulte la page ${path || '/'}`,
      product_view: `Regarde ${p ? p.name : 'un produit'}`,
      cart_add: `Ajoute ${qty || 1} × ${p ? p.name : 'un produit'} au panier`,
      cart_remove: `Retire ${p ? p.name : 'un produit'} du panier`,
      checkout_start: `Commence une commande${amount ? ` de ${eur(amount)}` : ''}`,
      trade_open: `Prépare : ${str(d.what, 120) || 'une opération'}${amount ? ` (${eur(amount)})` : ''}`,
      trade_cancel: `Abandonne : ${str(d.what, 120) || 'une opération'}`,
      whatsapp: 'Ouvre la conversation WhatsApp',
    }[type];
    if (cart) {
      if (u) u.cart = cart;
      else state.visitors[visitor] = { ...(state.visitors[visitor] || {}), cart };
    }
    if (visitor) {
      state.visitors[visitor] = { ...(state.visitors[visitor] || {}), lastSeen: now() };
      const keys = Object.keys(state.visitors);
      if (keys.length > 5000) {
        keys.sort((a, b) => (state.visitors[a].lastSeen || 0) - (state.visitors[b].lastSeen || 0));
        for (const k of keys.slice(0, keys.length - 5000)) delete state.visitors[k];
      }
    }
    // les simples pages vues ne sont gardées que pour les clients connectés (hors administrateurs)
    if (u && u.role === 'admin') { save(); return { ok: true }; }
    if (type !== 'page' || u) ev(type, u, label, { id: p?.id, qty, amount, path }, visitor);
    save();
    return { ok: true };
  });

  // --- Comptes ---
  route('POST', '/api/auth/register', {}, async ({ body, ip }) => {
    limit('reg:' + ip, 10, 3600000);
    const email = str(body.email, 160).toLowerCase();
    const password = String(body.password || '');
    if (!EMAIL_RE.test(email)) fail(400, 'Adresse e-mail invalide.');
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      fail(400, 'Le mot de passe doit faire au moins 10 caractères, avec des lettres et des chiffres.');
    }
    if (password.length > 200) fail(400, 'Mot de passe trop long.');
    const firstName = str(body.firstName, 60), lastName = str(body.lastName, 60);
    if (!firstName || !lastName) fail(400, 'Nom et prénom obligatoires.');
    const birthdate = str(body.birthdate, 10);
    const bd = Date.parse(birthdate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || !Number.isFinite(bd)) fail(400, 'Date de naissance invalide.');
    if (now() - bd < 18 * 365.25 * DAY) fail(400, 'Vous devez être majeur pour ouvrir un compte.');
    const phone = str(body.phone, 30);
    if (!/^[+\d][\d\s.-]{7,}$/.test(phone)) fail(400, 'Numéro de téléphone invalide.');
    const address = str(body.address, 200), zip = str(body.zip, 12), city = str(body.city, 80);
    if (!address || !zip || !city) fail(400, 'Adresse complète obligatoire.');
    if (!body.accept) fail(400, 'Vous devez accepter les conditions générales.');
    if (state.emailIndex[email]) fail(409, 'Un compte existe déjà avec cette adresse e-mail.');

    state.seq.user++;
    const id = state.seq.user;
    const user = {
      id, clientNo: 'MO' + String(100000 + id), email, passHash: await deps.hashPassword(password),
      firstName, lastName, phone, address, zip, city, country: str(body.country || 'France', 60), birthdate,
      role: deps.adminEmails?.includes(email) ? 'admin' : 'client',
      cash: 0, held: 0, goldMg: 0, heldMg: 0, totpEnabled: false, totpSecret: null, failed: 0, lockedUntil: 0,
      createdAt: iso(), lastSeen: now(), notifs: [], cart: [],
    };
    state.users[id] = user;
    state.emailIndex[email] = id;
    addLedger(user, { type: 'ouverture', label: 'Ouverture du compte', amount: 0 });
    linkVisitor(user, body.visitor);
    ev('register', user, `Ouvre son compte (${user.city})`);
    notify(user, 'Bienvenue ! Alimentez votre compte pour acheter votre premier gramme d\'or.', '#/espace');
    const token = await openSession(user);
    save();
    return { status: 201, token, data: { user: publicUser(user, state.sessions[await deps.sha256(token)].csrf) } };
  });

  route('POST', '/api/auth/login', {}, async ({ body, ip }) => {
    limit('login:' + ip, 30, 900000);
    const email = str(body.email, 160).toLowerCase();
    const password = String(body.password || '').slice(0, 200);
    const user = state.users[state.emailIndex[email]];
    if (user && user.lockedUntil > now()) {
      fail(429, 'Compte temporairement verrouillé après plusieurs erreurs. Réessayez dans 15 minutes.');
    }
    const ok = await deps.verifyPassword(password, user ? user.passHash : null);
    if (!user || !ok) {
      if (user) {
        user.failed = (user.failed || 0) + 1;
        ev('login_failed', user, `Mot de passe erroné (${user.failed}/5)`, { ip });
        if (user.failed >= 5) { user.lockedUntil = now() + 15 * 60000; user.failed = 0; ev('login_locked', user, 'Compte verrouillé 15 min après 5 erreurs', { ip }); }
        save();
      }
      fail(401, 'E-mail ou mot de passe incorrect.');
    }
    if (user.totpEnabled) {
      if (!body.code) return { data: { need2fa: true } };
      limit('totp:' + user.id, 10, 900000);
      if (!(await verifyTotp(deps, user.totpSecret, body.code))) { ev('login_failed', user, 'Code de double authentification erroné'); save(); fail(401, 'Code de double authentification incorrect.'); }
    }
    user.failed = 0; user.lockedUntil = 0; user.lastLogin = iso(); user.lastSeen = now();
    linkVisitor(user, body.visitor);
    ev('login', user, 'Se connecte', { ip });
    const token = await openSession(user);
    save();
    return { token, data: { user: publicUser(user, state.sessions[await deps.sha256(token)].csrf) } };
  });

  route('POST', '/api/auth/logout', { auth: true }, ({ auth }) => {
    delete state.sessions[auth.key];
    ev('logout', auth.user, 'Se déconnecte');
    save();
    return { token: null, data: { ok: true } };
  });

  route('GET', '/api/auth/me', {}, ({ auth }) => ({ user: auth ? publicUser(auth.user, auth.session.csrf) : null }));

  route('POST', '/api/auth/password', { auth: true }, async ({ auth, body }) => {
    const u = auth.user;
    limit('pw:' + u.id, 10, 900000);
    if (!(await deps.verifyPassword(String(body.current || ''), u.passHash))) fail(401, 'Mot de passe actuel incorrect.');
    const next = String(body.next || '');
    if (next.length < 10 || !/[A-Za-z]/.test(next) || !/\d/.test(next) || next.length > 200) {
      fail(400, 'Le nouveau mot de passe doit faire au moins 10 caractères, avec des lettres et des chiffres.');
    }
    u.passHash = await deps.hashPassword(next);
    for (const [k, s] of Object.entries(state.sessions)) if (s.userId === u.id && k !== auth.key) delete state.sessions[k];
    ev('security', u, 'Change son mot de passe');
    save();
    return { ok: true };
  });

  route('POST', '/api/auth/profile', { auth: true }, ({ auth, body }) => {
    const u = auth.user;
    const phone = str(body.phone, 30), address = str(body.address, 200), zip = str(body.zip, 12), city = str(body.city, 80);
    if (!/^[+\d][\d\s.-]{7,}$/.test(phone)) fail(400, 'Numéro de téléphone invalide.');
    if (!address || !zip || !city) fail(400, 'Adresse complète obligatoire.');
    Object.assign(u, { phone, address, zip, city, country: str(body.country || u.country, 60) });
    ev('profile', u, 'Modifie ses coordonnées');
    save();
    return { user: publicUser(u, auth.session.csrf) };
  });

  route('POST', '/api/auth/2fa/setup', { auth: true }, ({ auth }) => {
    const u = auth.user;
    if (u.totpEnabled) fail(400, 'La double authentification est déjà active.');
    const bytes = new Uint8Array(20);
    const hex = deps.randomToken(20);
    for (let i = 0; i < 20; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    u.totpPending = base32Encode(bytes);
    save();
    const label = encodeURIComponent(`${S().shopName}:${u.email}`);
    return { secret: u.totpPending, uri: `otpauth://totp/${label}?secret=${u.totpPending}&issuer=${encodeURIComponent(S().shopName)}` };
  });

  route('POST', '/api/auth/2fa/enable', { auth: true }, async ({ auth, body }) => {
    const u = auth.user;
    if (!u.totpPending) fail(400, 'Lancez d\'abord la configuration.');
    if (!(await verifyTotp(deps, u.totpPending, body.code))) fail(400, 'Code incorrect. Vérifiez l\'heure de votre téléphone.');
    u.totpSecret = u.totpPending; u.totpPending = null; u.totpEnabled = true;
    ev('security', u, 'Active la double authentification');
    save();
    return { ok: true };
  });

  route('POST', '/api/auth/2fa/disable', { auth: true }, async ({ auth, body }) => {
    const u = auth.user;
    if (!(await deps.verifyPassword(String(body.password || ''), u.passHash))) fail(401, 'Mot de passe incorrect.');
    if (!(await verifyTotp(deps, u.totpSecret, body.code))) fail(401, 'Code incorrect.');
    u.totpEnabled = false; u.totpSecret = null;
    ev('security', u, 'Désactive la double authentification');
    save();
    return { ok: true };
  });

  // --- Espace client ---
  route('GET', '/api/account', { auth: true }, ({ auth }) => accountView(auth.user, auth.session.csrf));

  route('POST', '/api/notifs/read', { auth: true }, ({ auth }) => {
    for (const n of auth.user.notifs || []) n.read = true;
    save();
    return { ok: true };
  });

  route('POST', '/api/wallet/buy-gold', { auth: true }, ({ auth, body }) => {
    const u = auth.user, s = S();
    const spot = liveSpot();
    const unit = gramBuyCents(spot, s);
    checkMove(unit, body.expected, 'buy');
    let mg;
    if (body.euros != null && body.euros !== '') {
      const cents = Math.round(positiveNumber(body.euros, 'Montant') * 100);
      mg = Math.floor(cents * 1000 / unit);
    } else {
      mg = Math.floor(positiveNumber(body.grams, 'Quantité') * 1000);
    }
    if (mg < s.minGramTrade * 1000) fail(400, `Minimum ${String(s.minGramTrade).replace('.', ',')} g par opération.`);
    const cost = Math.round(mg * unit / 1000);
    if (cost > u.cash) fail(400, `Solde insuffisant : il faut ${eur(cost)}, vous avez ${eur(u.cash)}. Alimentez votre compte.`);
    return trade(u, { kind: 'buy_gold', mg, unit, amount: cost, label: `${gtxt(mg)} d'or à ${eur(unit)}/g` });
  });

  route('POST', '/api/wallet/sell-gold', { auth: true }, ({ auth, body }) => {
    const u = auth.user, s = S();
    const spot = liveSpot();
    const unit = gramSellCents(spot, s);
    checkMove(unit, body.expected, 'sell');
    const mg = body.all ? u.goldMg : Math.floor(positiveNumber(body.grams, 'Quantité') * 1000);
    if (mg <= 0) fail(400, 'Vous n\'avez pas d\'or disponible sur votre compte.');
    if (mg < s.minGramTrade * 1000 && mg !== u.goldMg) fail(400, `Minimum ${String(s.minGramTrade).replace('.', ',')} g par opération.`);
    if (mg > u.goldMg) fail(400, `Vous avez ${gtxt(u.goldMg)} d'or disponible sur votre compte.`);
    const proceeds = Math.floor(mg * unit / 1000);
    return trade(u, { kind: 'sell_gold', mg, unit, amount: proceeds, label: `${gtxt(mg)} d'or à ${eur(unit)}/g` });
  });

  route('POST', '/api/wallet/buy-product', { auth: true }, ({ auth, body }) => {
    const u = auth.user;
    const p = product(str(body.productId, 80));
    if (!p || !p.active) fail(404, 'Produit introuvable.');
    const qty = intQty(body.qty);
    if ((p.stock || 0) < qty) fail(400, `Stock insuffisant (${p.stock || 0} disponible(s)).`);
    const spot = liveSpot();
    const unit = unitPriceCents(p, spot, qty);
    checkMove(unit, body.expected, 'buy');
    const cost = unit * qty;
    if (cost > u.cash) fail(400, `Solde insuffisant : il faut ${eur(cost)}, vous avez ${eur(u.cash)}. Alimentez votre compte.`);
    return trade(u, { kind: 'buy_product', productId: p.id, name: p.name, qty, unit, amount: cost, label: `${qty} × ${p.name}` });
  });

  route('POST', '/api/wallet/sell-product', { auth: true }, ({ auth, body }) => {
    const u = auth.user;
    const p = product(str(body.productId, 80));
    if (!p) fail(404, 'Produit introuvable.');
    const qty = intQty(body.qty);
    if ((vaultOf(u.id)[p.id] || 0) < qty) fail(400, 'Vous n\'avez pas cette quantité au coffre.');
    const spot = liveSpot();
    const unit = buybackCents(p, spot, S());
    checkMove(unit, body.expected, 'sell');
    return trade(u, { kind: 'sell_product', productId: p.id, name: p.name, qty, unit, amount: unit * qty, label: `${qty} × ${p.name}` });
  });

  route('POST', '/api/requests/:ref/cancel', { auth: true }, ({ auth, params }) => {
    const r = state.requests.find((x) => x.ref === params.ref && x.userId === auth.user.id);
    if (!r) fail(404, 'Demande introuvable.');
    if (r.status !== 'en_attente') fail(400, 'Cette demande a déjà été traitée.');
    closeRequest(r, 'annulee');
    save();
    return { request: r };
  });

  route('POST', '/api/wallet/deliver', { auth: true }, ({ auth, body }) => {
    const u = auth.user, s = S();
    const delivery = body.delivery === 'boutique' ? 'boutique' : 'domicile';
    const v = vaultOf(u.id);
    const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).map((it) => {
      const p = product(str(it.id, 80));
      if (!p) fail(404, 'Produit introuvable.');
      const qty = intQty(it.qty);
      if ((v[p.id] || 0) < qty) fail(400, `Vous n'avez pas ${qty} × ${p.name} au coffre.`);
      return { id: p.id, name: p.name, qty, unit: 0, line: 0 };
    });
    if (!items.length) fail(400, 'Choisissez au moins un produit.');
    const spot = displaySpot();
    const value = spot && spot.eur ? items.reduce((a, it) => a + metalValueCents(product(it.id), spot) * it.qty, 0) : 0;
    const fee = shippingCents(value, delivery, s);
    if (fee > u.cash) fail(400, `Frais de livraison de ${eur(fee)} : solde insuffisant.`);
    const address = delivery === 'domicile' ? validateAddress(body.address) : null;
    for (const it of items) v[it.id] -= it.qty;
    u.cash -= fee;
    state.seq.order++;
    const order = {
      id: state.seq.order, ref: makeRef('LIV', state.seq.order), kind: 'coffre', userId: u.id, email: u.email,
      items, subtotal: 0, shipping: fee, total: fee, delivery, address, payment: 'solde',
      status: 'preparation', paidAt: iso(), paidVia: 'solde', createdAt: iso(), updatedAt: iso(),
    };
    state.orders.push(order);
    addLedger(u, { type: 'sortie_coffre', label: `Sortie du coffre (${delivery === 'domicile' ? 'livraison' : 'retrait boutique'}) ${order.ref}`, amount: -fee, ref: order.ref });
    ev('deliver', u, `Demande la ${delivery === 'domicile' ? 'livraison' : 'remise en boutique'} de ${items.map((i) => `${i.qty} × ${i.name}`).join(', ')}`, { ref: order.ref });
    save();
    return { order };
  });

  route('POST', '/api/wallet/deposit', { auth: true }, async ({ auth, body, origin }) => {
    const u = auth.user;
    const amount = Math.round(positiveNumber(body.amount, 'Montant') * 100);
    if (amount < 1000) fail(400, 'Minimum 10 € par versement.');
    if (amount > 10000000) fail(400, 'Maximum 100 000 € par versement : contactez-nous pour plus.');
    const method = body.method === 'carte' ? 'carte' : 'virement';
    state.seq.deposit++;
    const dep = { id: state.seq.deposit, ref: makeRef('DEP', state.seq.deposit), userId: u.id, amount, method, status: 'en_attente', createdAt: iso() };
    state.deposits.push(dep);
    ev('deposit_request', u, `Annonce un versement de ${eur(amount)} par ${method}`, { ref: dep.ref, amount });
    if (method === 'carte') {
      if (instantPayments) {
        validateDeposit(dep);
        save();
        return { deposit: dep, instant: true };
      }
      if (!deps.stripe) fail(400, 'Le paiement par carte n\'est pas encore activé : utilisez le virement.');
      const session = await deps.stripe.checkout({
        amount, description: `Versement sur compte ${u.clientNo}`, ref: dep.ref, kind: 'deposit', email: u.email,
        successUrl: `${origin}/#/espace?paiement=ok`, cancelUrl: `${origin}/#/espace?paiement=annule`,
      });
      dep.stripeSession = session.id;
      save();
      return { deposit: dep, redirect: session.url };
    }
    save();
    const s = S();
    return { deposit: dep, bank: { holder: s.bankHolder, iban: s.bankIban, bic: s.bankBic, ref: dep.ref } };
  });

  function validateDeposit(dep) {
    if (dep.status !== 'en_attente') return;
    const u = state.users[dep.userId];
    dep.status = 'validee'; dep.validatedAt = iso();
    u.cash += dep.amount;
    addLedger(u, { type: 'versement', label: `Versement ${dep.method === 'carte' ? 'par carte' : 'par virement'} ${dep.ref}`, amount: dep.amount, ref: dep.ref });
    notify(u, `${eur(dep.amount)} ont été crédités sur votre compte.`, '#/espace');
    ev('deposit_validated', u, `Versement ${dep.ref} de ${eur(dep.amount)} crédité`, { ref: dep.ref, amount: dep.amount });
  }

  route('POST', '/api/wallet/withdraw', { auth: true }, async ({ auth, body }) => {
    const u = auth.user;
    if (!(await deps.verifyPassword(String(body.password || ''), u.passHash))) { ev('security', u, 'Mot de passe erroné lors d\'un retrait'); save(); fail(401, 'Mot de passe incorrect.'); }
    if (u.totpEnabled && !(await verifyTotp(deps, u.totpSecret, body.code))) fail(401, 'Code de double authentification incorrect.');
    const amount = Math.round(positiveNumber(body.amount, 'Montant') * 100);
    if (amount < 1000) fail(400, 'Minimum 10 € par retrait.');
    if (amount > u.cash) fail(400, `Solde insuffisant (${eur(u.cash)} disponibles).`);
    const iban = normalizeIban(body.iban);
    const holder = str(body.holder, 120);
    if (!holder) fail(400, 'Titulaire du compte obligatoire.');
    u.cash -= amount;
    state.seq.withdrawal++;
    const w = { id: state.seq.withdrawal, ref: makeRef('RET', state.seq.withdrawal), userId: u.id, amount, iban, holder, status: 'en_attente', createdAt: iso() };
    state.withdrawals.push(w);
    addLedger(u, { type: 'retrait', label: `Retrait vers ${iban.slice(0, 4)}…${iban.slice(-4)} (${w.ref})`, amount: -amount, ref: w.ref });
    ev('withdraw_request', u, `Demande un retrait de ${eur(amount)} vers ${iban.slice(0, 4)}…${iban.slice(-4)}`, { ref: w.ref, amount });
    save();
    return { withdrawal: w };
  });

  // --- Commandes boutique ---
  route('POST', '/api/orders', { auth: true }, async ({ auth, body, origin }) => {
    const u = auth.user, s = S();
    const delivery = ['domicile', 'boutique', 'coffre'].includes(body.delivery) ? body.delivery : fail(400, 'Mode de livraison invalide.');
    const payment = ['solde', 'virement', 'carte'].includes(body.payment) ? body.payment : fail(400, 'Mode de paiement invalide.');
    const raw = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    if (!raw.length) fail(400, 'Votre panier est vide.');
    const spot = liveSpot();
    const merged = new Map();
    for (const it of raw) {
      const id = str(it.id, 80);
      merged.set(id, (merged.get(id) || 0) + intQty(it.qty));
    }
    const items = [...merged].map(([id, qty]) => {
      const p = product(id);
      if (!p || !p.active) fail(404, 'Un produit du panier n\'est plus disponible.');
      if (qty > 999) fail(400, 'Quantité invalide.');
      if ((p.stock || 0) < qty) fail(400, `Stock insuffisant pour ${p.name} (${p.stock || 0} disponible(s)).`);
      const unit = unitPriceCents(p, spot, qty);
      return { id: p.id, name: p.name, qty, unit, line: unit * qty };
    });
    const subtotal = items.reduce((a, it) => a + it.line, 0);
    const shipping = shippingCents(subtotal, delivery, s);
    const total = subtotal + shipping;
    checkMove(total, body.expectedTotal, 'buy');
    const address = delivery === 'domicile' ? validateAddress(body.address) : null;
    if (payment === 'solde' && total > u.cash) fail(400, `Solde insuffisant : il faut ${eur(total)}, vous avez ${eur(u.cash)}.`);
    if (payment === 'carte' && !deps.stripe && !instantPayments) fail(400, 'Le paiement par carte n\'est pas encore activé : choisissez le virement ou votre solde.');

    for (const it of items) setOverride(it.id, { stock: product(it.id).stock - it.qty });
    state.seq.order++;
    const order = {
      id: state.seq.order, ref: makeRef('CMD', state.seq.order), kind: 'boutique', userId: u.id, email: u.email,
      items, subtotal, shipping, total, delivery, address, payment, status: 'en_attente_paiement',
      createdAt: iso(), updatedAt: iso(),
    };
    state.orders.push(order);
    u.cart = [];
    ev('order_created', u, `Commande ${order.ref} : ${items.map((i) => `${i.qty} × ${i.name}`).join(', ')} (${eur(total)})`, { ref: order.ref, amount: total });
    const out = { order };
    if (s.approvalBuy) {
      // Deuxième confirmation : l'administrateur valide avant tout paiement.
      order.status = 'a_valider';
      order.expiresAt = new Date(now() + s.approvalWindowMin * 60000).toISOString();
      if (payment === 'solde') { u.cash -= total; u.held = (u.held || 0) + total; }
      save();
      return out;
    }
    await startPayment(order, u, origin, out);
    save();
    return out;
  });

  async function startPayment(order, u, origin, out) {
    const s = S();
    if (order.payment === 'solde') {
      if (order.status === 'a_valider') u.held -= order.total;
      else u.cash -= order.total;
      addLedger(u, { type: 'commande', label: `Commande ${order.ref}`, amount: -order.total, ref: order.ref });
      applyPaid(order, 'solde');
    } else {
      order.status = 'en_attente_paiement';
      if (order.payment === 'carte') {
        if (instantPayments) applyPaid(order, 'carte');
        else if (origin && deps.stripe) {
          const session = await deps.stripe.checkout({
            amount: order.total, description: `Commande ${order.ref}`, ref: order.ref, kind: 'order', email: u.email,
            successUrl: `${origin}/#/commande/${order.ref}?paiement=ok`, cancelUrl: `${origin}/#/commande/${order.ref}?paiement=annule`,
          });
          order.stripeSession = session.id;
          if (out) out.redirect = session.url;
        }
      } else if (out) out.bank = { holder: s.bankHolder, iban: s.bankIban, bic: s.bankBic, ref: order.ref };
    }
    order.updatedAt = iso();
  }

  route('POST', '/api/orders/:ref/pay', { auth: true }, async ({ auth, params, origin }) => {
    const o = state.orders.find((x) => x.ref === params.ref && x.userId === auth.user.id);
    if (!o) fail(404, 'Commande introuvable.');
    if (o.status !== 'en_attente_paiement' || o.payment !== 'carte') fail(400, 'Cette commande n\'attend pas de paiement par carte.');
    if (instantPayments) { applyPaid(o, 'carte'); save(); return { order: o }; }
    if (!deps.stripe) fail(400, 'Paiement par carte indisponible.');
    const session = await deps.stripe.checkout({
      amount: o.total, description: `Commande ${o.ref}`, ref: o.ref, kind: 'order', email: auth.user.email,
      successUrl: `${origin}/#/commande/${o.ref}?paiement=ok`, cancelUrl: `${origin}/#/commande/${o.ref}?paiement=annule`,
    });
    o.stripeSession = session.id;
    save();
    return { redirect: session.url };
  });

  route('GET', '/api/orders/:ref', { auth: true }, ({ auth, params }) => {
    const o = state.orders.find((x) => x.ref === params.ref);
    if (!o || (o.userId !== auth.user.id && auth.user.role !== 'admin')) fail(404, 'Commande introuvable.');
    const s = S();
    return { order: o, bank: { holder: s.bankHolder, iban: s.bankIban, bic: s.bankBic, ref: o.ref } };
  });

  route('POST', '/api/orders/:ref/cancel', { auth: true }, ({ auth, params }) => {
    const o = state.orders.find((x) => x.ref === params.ref);
    if (!o || o.userId !== auth.user.id) fail(404, 'Commande introuvable.');
    if (!['a_valider', 'en_attente_paiement'].includes(o.status)) fail(400, 'Cette commande ne peut plus être annulée en ligne : contactez-nous.');
    cancelOrder(o);
    ev('order_cancelled', auth.user, `Annule sa commande ${o.ref}`, { ref: o.ref });
    save();
    return { order: o };
  });

  route('POST', '/api/contact', {}, ({ body, ip, auth }) => {
    limit('contact:' + ip, 5, 3600000);
    const msg = {
      name: str(body.name, 120), email: str(body.email, 160), phone: str(body.phone, 30),
      subject: str(body.subject, 160), message: str(body.message, 4000),
    };
    if (!msg.name || !EMAIL_RE.test(msg.email) || msg.message.length < 5) fail(400, 'Merci de renseigner votre nom, un e-mail valide et votre message.');
    state.seq.message++;
    state.messages.push({ id: state.seq.message, ...msg, userId: auth?.user.id || null, createdAt: iso(), handled: false });
    ev('message', auth?.user || null, `Envoie un message : « ${msg.subject} »`);
    save();
    return { ok: true };
  });

  // --- Administration ---
  const clientName = (id) => { const u = state.users[id]; return u ? `${u.firstName} ${u.lastName} (${u.clientNo})` : '—'; };
  const withClient = (x) => ({ ...x, client: clientName(x.userId), phone: state.users[x.userId]?.phone });

  route('GET', '/api/admin/overview', { admin: true }, () => {
    const spot = displaySpot();
    const s = S();
    const users = Object.values(state.users);
    const vaultTotals = {};
    for (const v of Object.values(state.vault)) for (const [id, q] of Object.entries(v)) if (q > 0) vaultTotals[id] = (vaultTotals[id] || 0) + q;
    // prix actuel pour comparer avec le prix bloqué des demandes en attente
    const current = (r) => {
      if (!spot || !spot.eur) return null;
      if (r.kind === 'buy_gold') return Math.round(r.mg * gramBuyCents(spot, s) / 1000);
      if (r.kind === 'sell_gold') return Math.floor(r.mg * gramSellCents(spot, s) / 1000);
      const p = product(r.productId);
      if (r.kind === 'buy_product') return unitPriceCents(p, spot, r.qty) * r.qty;
      return buybackCents(p, spot, s) * r.qty;
    };
    const orderNow = (o) => (spot && spot.eur ? o.items.reduce((a, i) => a + unitPriceCents(product(i.id), spot, i.qty) * i.qty, 0) + o.shipping : null);
    return {
      stats: {
        users: users.length,
        online: users.filter((u) => u.lastSeen && now() - u.lastSeen < ONLINE_MS).length,
        goldOwedMg: users.reduce((a, u) => a + u.goldMg + (u.heldMg || 0), 0),
        cashOwed: users.reduce((a, u) => a + u.cash + (u.held || 0), 0),
        vaultTotals,
        toApprove: state.requests.filter((r) => r.status === 'en_attente').length + state.orders.filter((o) => o.status === 'a_valider').length,
        ordersToHandle: state.orders.filter((o) => ['en_attente_paiement', 'payee', 'preparation', 'expediee', 'prete_retrait'].includes(o.status)).length,
        today: state.events.filter((e) => now() - e.t < DAY).length,
      },
      settings: s,
      products: allProducts().map((p) => (spot && spot.eur ? publicProduct(p, spot) : p)),
      requests: state.requests.slice().reverse().slice(0, 300).map((r) => ({ ...withClient(r), current: r.status === 'en_attente' ? current(r) : null })),
      orders: state.orders.slice().reverse().slice(0, 300).map((o) => ({ ...withClient(o), current: o.status === 'a_valider' ? orderNow(o) : null })),
      deposits: state.deposits.slice().reverse().slice(0, 300).map(withClient),
      withdrawals: state.withdrawals.slice().reverse().slice(0, 300).map(withClient),
      messages: state.messages.slice().reverse().slice(0, 300),
      events: state.events.slice(-400).reverse().map((e) => ({ ...e, client: e.userId ? clientName(e.userId) : 'Visiteur' })),
      intentions: intentions(),
      users: users.slice().reverse().slice(0, 1000).map((u) => ({
        id: u.id, clientNo: u.clientNo, email: u.email, name: `${u.firstName} ${u.lastName}`, phone: u.phone,
        city: u.city, cash: u.cash + (u.held || 0), goldMg: u.goldMg + (u.heldMg || 0), role: u.role, totp: !!u.totpEnabled,
        createdAt: u.createdAt, lastSeen: u.lastSeen ? new Date(u.lastSeen).toISOString() : null,
        online: !!(u.lastSeen && now() - u.lastSeen < ONLINE_MS), cartCount: (u.cart || []).reduce((a, l) => a + l.qty, 0),
      })),
    };
  });

  route('GET', '/api/admin/users/:id', { admin: true }, ({ params }) => {
    const u = state.users[params.id];
    if (!u) fail(404, 'Client introuvable.');
    const view = accountView(u, null);
    return {
      ...view,
      user: { ...view.user, birthdate: u.birthdate, lastLogin: u.lastLogin, lastSeen: u.lastSeen ? new Date(u.lastSeen).toISOString() : null, online: !!(u.lastSeen && now() - u.lastSeen < ONLINE_MS) },
      cart: cartLines(u.cart), cartValue: cartValue(u.cart),
      events: state.events.filter((e) => e.userId === u.id).slice(-400).reverse(),
      messages: state.messages.filter((m) => m.userId === u.id || m.email === u.email).reverse(),
    };
  });

  route('POST', '/api/admin/requests/:id/:action', { admin: true }, ({ params, body, auth }) => {
    const r = state.requests.find((x) => String(x.id) === params.id);
    if (!r) fail(404, 'Demande introuvable.');
    if (r.status !== 'en_attente') fail(400, `Demande déjà ${REQUEST_STATUS[r.status].toLowerCase()}.`);
    if (Date.parse(r.expiresAt) < now()) { closeRequest(r, 'expiree'); save(); fail(400, 'Demande expirée : les fonds ont été rendus au client.'); }
    if (params.action === 'approve') closeRequest(r, 'validee', str(body.note, 200), auth.user);
    else if (params.action === 'refuse') closeRequest(r, 'refusee', str(body.note, 200), auth.user);
    else fail(400, 'Action invalide.');
    save();
    return { request: r };
  });

  route('PUT', '/api/admin/products/:id', { admin: true }, ({ params, body, auth }) => {
    const p = product(params.id);
    if (!p) fail(404, 'Produit introuvable.');
    const patch = {};
    if (body.premium != null) {
      const v = Number(body.premium);
      if (!Number.isFinite(v) || v < -0.2 || v > 2) fail(400, 'Prime invalide (entre -20 % et 200 %).');
      patch.premium = v;
    }
    if (body.stock != null) {
      const v = Number(body.stock);
      if (!Number.isInteger(v) || v < 0 || v > 1e6) fail(400, 'Stock invalide.');
      patch.stock = v;
    }
    if (body.offer != null) patch.offer = !!body.offer;
    if (body.active != null) patch.active = !!body.active;
    setOverride(p.id, patch);
    ev('admin', auth.user, `Admin : modifie le produit ${p.name}`);
    save();
    return { product: product(p.id) };
  });

  const SETTING_KEYS = {
    gramBuySpread: [0, 0.5], gramSellSpread: [0, 0.5], buybackSpread: [0, 0.5], maxPriceMove: [0, 0.05],
    shippingFee: [0, 100000], freeShippingFrom: [0, 10000000], minGramTrade: [0.001, 100], staleAfterMin: [5, 1440],
    approvalWindowMin: [5, 1440],
  };
  const TEXT_KEYS = ['shopName', 'shopAddress', 'shopHours', 'shopPhone', 'shopEmail', 'bankHolder', 'bankIban', 'bankBic'];
  route('PUT', '/api/admin/settings', { admin: true }, ({ body, auth }) => {
    for (const [k, [min, max]] of Object.entries(SETTING_KEYS)) {
      if (body[k] == null || body[k] === '') continue;
      const v = Number(body[k]);
      if (!Number.isFinite(v) || v < min || v > max) fail(400, `Valeur invalide pour ${k}.`);
      state.settings[k] = v;
    }
    for (const k of TEXT_KEYS) if (body[k] != null) state.settings[k] = str(body[k], 200);
    if (body.whatsapp != null) {
      const w = String(body.whatsapp).replace(/[^\d]/g, '');
      if (w && (w.length < 8 || w.length > 15)) fail(400, 'Numéro WhatsApp invalide (format international, ex. 33612345678).');
      state.settings.whatsapp = w;
    }
    if (body.approvalBuy != null) state.settings.approvalBuy = !!body.approvalBuy;
    if (body.approvalSell != null) state.settings.approvalSell = !!body.approvalSell;
    if (body.fallbackSpot !== undefined) {
      if (!body.fallbackSpot) state.settings.fallbackSpot = null;
      else {
        const f = body.fallbackSpot;
        const fs = { or: Number(f.or), argent: Number(f.argent), platine: Number(f.platine) };
        if (!(fs.or > 0 && fs.argent > 0 && fs.platine > 0)) fail(400, 'Cours de secours invalide.');
        state.settings.fallbackSpot = fs;
      }
    }
    ev('admin', auth.user, 'Admin : modifie les réglages');
    save();
    return { settings: S() };
  });

  route('POST', '/api/admin/orders/:ref/status', { admin: true }, async ({ params, body, auth, origin }) => {
    const o = state.orders.find((x) => x.ref === params.ref);
    if (!o) fail(404, 'Commande introuvable.');
    const u = state.users[o.userId];
    const st = String(body.status || '');
    const note = str(body.note, 200);
    if (st === 'valider') {
      if (o.status !== 'a_valider') fail(400, 'Cette commande n\'attend pas de validation.');
      if (o.expiresAt && Date.parse(o.expiresAt) < now()) { cancelOrder(o, 'expiree'); save(); fail(400, 'Commande expirée : fonds et stock rendus.'); }
      o.validatedAt = iso(); o.validatedBy = auth.user.clientNo;
      await startPayment(o, u, origin, null);
      notify(u, o.paidAt ? `Votre commande ${o.ref} est validée et payée.` : `Votre commande ${o.ref} est validée : vous pouvez la régler.`, `#/commande/${o.ref}`);
      ev('order_validated', u, `Commande ${o.ref} validée par ${auth.user.firstName}`, { ref: o.ref });
    } else if (st === 'refuser') {
      if (o.status !== 'a_valider') fail(400, 'Cette commande n\'attend pas de validation.');
      cancelOrder(o, 'refusee');
      o.note = note;
      notify(u, `Votre commande ${o.ref} n'a pas été validée${note ? ` : ${note}` : ''}. Les fonds réservés sont disponibles.`, `#/commande/${o.ref}`);
      ev('order_refused', u, `Commande ${o.ref} refusée${note ? ` (${note})` : ''}`, { ref: o.ref });
    } else if (st === 'payee') {
      if (o.status !== 'en_attente_paiement') fail(400, 'Cette commande n\'attend pas de paiement.');
      applyPaid(o, o.payment);
      ev('order_paid', u, `Paiement de la commande ${o.ref} reçu`, { ref: o.ref });
    } else if (st === 'annulee') {
      cancelOrder(o);
      notify(u, `Votre commande ${o.ref} a été annulée.`, `#/commande/${o.ref}`);
      ev('order_cancelled', u, `Commande ${o.ref} annulée par l'administrateur`, { ref: o.ref });
    } else if (['preparation', 'expediee', 'prete_retrait', 'livree'].includes(st)) {
      if (!o.paidAt) fail(400, 'Commande non payée.');
      if (o.delivery === 'coffre') fail(400, 'Commande placée au coffre : utilisez une sortie du coffre.');
      o.status = st;
      if (body.tracking != null) o.tracking = str(body.tracking, 120);
      o.updatedAt = iso();
      notify(u, `Commande ${o.ref} : ${ORDER_STATUS[st].toLowerCase()}${o.tracking ? ` (suivi ${o.tracking})` : ''}.`, `#/commande/${o.ref}`);
      ev('order_status', u, `Commande ${o.ref} : ${ORDER_STATUS[st]}`, { ref: o.ref });
    } else fail(400, 'Statut invalide.');
    save();
    return { order: o };
  });

  route('POST', '/api/admin/deposits/:id/:action', { admin: true }, ({ params }) => {
    const d = state.deposits.find((x) => String(x.id) === params.id);
    if (!d) fail(404, 'Versement introuvable.');
    if (d.status !== 'en_attente') fail(400, 'Versement déjà traité.');
    if (params.action === 'validate') validateDeposit(d);
    else if (params.action === 'refuse') { d.status = 'refusee'; d.validatedAt = iso(); notify(state.users[d.userId], `Le versement ${d.ref} n'a pas été reçu ou a été refusé.`, '#/espace'); }
    else fail(400, 'Action invalide.');
    save();
    return { deposit: d };
  });

  route('POST', '/api/admin/withdrawals/:id/:action', { admin: true }, ({ params }) => {
    const w = state.withdrawals.find((x) => String(x.id) === params.id);
    if (!w) fail(404, 'Retrait introuvable.');
    if (w.status !== 'en_attente') fail(400, 'Retrait déjà traité.');
    const u = state.users[w.userId];
    if (params.action === 'done') {
      w.status = 'effectue'; w.doneAt = iso();
      notify(u, `Votre retrait de ${eur(w.amount)} a été envoyé sur votre compte bancaire.`, '#/espace/operations');
      ev('withdraw_done', u, `Retrait ${w.ref} de ${eur(w.amount)} envoyé`, { ref: w.ref });
    } else if (params.action === 'refuse') {
      w.status = 'refuse'; w.doneAt = iso();
      u.cash += w.amount;
      addLedger(u, { type: 'retrait_annule', label: `Retrait ${w.ref} refusé : montant recrédité`, amount: w.amount, ref: w.ref });
      notify(u, `Votre retrait ${w.ref} a été refusé : le montant est recrédité. Contactez-nous.`, '#/espace/operations');
      ev('withdraw_refused', u, `Retrait ${w.ref} refusé`, { ref: w.ref });
    } else fail(400, 'Action invalide.');
    save();
    return { withdrawal: w };
  });

  route('POST', '/api/admin/messages/:id/handled', { admin: true }, ({ params }) => {
    const m = state.messages.find((x) => String(x.id) === params.id);
    if (!m) fail(404, 'Message introuvable.');
    m.handled = true;
    save();
    return { ok: true };
  });

  // ---------- Paiement carte confirmé (webhook Stripe) ----------
  function cardPaid(kind, ref, amount) {
    if (kind === 'deposit') {
      const d = state.deposits.find((x) => x.ref === ref);
      if (!d || d.amount !== amount) return false;
      validateDeposit(d);
    } else {
      const o = state.orders.find((x) => x.ref === ref);
      if (!o || o.total !== amount) return false;
      if (o.status !== 'en_attente_paiement') return false;
      applyPaid(o, 'carte');
      ev('order_paid', state.users[o.userId], `Paiement carte de la commande ${o.ref} reçu`, { ref: o.ref });
    }
    save();
    return true;
  }

  // ---------- Point d'entrée ----------
  async function handle({ method, path, body = {}, token, csrf, ip = 'local', origin = '' }) {
    try {
      sweep();
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = path.match(r.re);
        if (!m) continue;
        const params = {};
        r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
        const auth = await sessionFrom(token);
        if ((r.auth || r.admin) && !auth) fail(401, 'Connectez-vous pour continuer.');
        if (r.admin && auth.user.role !== 'admin') fail(403, 'Accès réservé.');
        if (method !== 'GET' && auth && csrf !== auth.session.csrf) fail(403, 'Session expirée : rechargez la page.');
        const res = await r.fn({ body: body || {}, params, auth, ip, origin });
        if (res && (res.data !== undefined || res.token !== undefined)) {
          return { status: res.status || 200, data: res.data, token: res.token };
        }
        return { status: 200, data: res };
      }
      return { status: 404, data: { error: 'Introuvable.' } };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, data: { error: e.message, ...(e.extra || {}) } };
      console.error(e);
      return { status: 500, data: { error: 'Erreur interne. Réessayez.' } };
    }
  }

  return { handle, cardPaid, product, allProducts };
}
