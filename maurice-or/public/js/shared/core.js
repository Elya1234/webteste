// Logique métier de Maurice Or : comptes, portefeuille or, commandes, admin.
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

export const ORDER_STATUS = {
  en_attente_paiement: 'En attente de paiement',
  payee: 'Payée',
  preparation: 'En préparation',
  expediee: 'Expédiée',
  prete_retrait: 'Prête à retirer en boutique',
  livree: 'Livrée',
  au_coffre: 'Au coffre',
  annulee: 'Annulée',
};

export function emptyState() {
  return {
    version: 1,
    seq: { user: 0, order: 0, ledger: 0, deposit: 0, withdrawal: 0, message: 0 },
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
  if (!/^\d{6}$/.test(code)) return false;
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

export function createCore({ state, save, deps, getSpot, instantPayments = false }) {
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

  // ---------- Sessions ----------
  async function openSession(user) {
    const token = deps.randomToken(32);
    const key = await deps.sha256(token);
    state.sessions[key] = { userId: user.id, csrf: deps.randomToken(16), createdAt: now(), lastSeen: now() };
    // ménage des sessions expirées
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
  }

  function cancelOrder(order) {
    if (order.status === 'annulee') return;
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
    if (order.paidAt && user && (order.paidVia === 'solde' || order.paidVia === 'carte')) {
      user.cash += order.total;
      addLedger(user, { type: 'remboursement', label: `Remboursement commande ${order.ref}`, amount: order.total, ref: order.ref });
    }
    if (order.kind === 'coffre' && user) {
      // livraison depuis le coffre annulée : les produits reviennent au coffre
      const v = vaultOf(order.userId);
      for (const it of order.items) v[it.id] = (v[it.id] || 0) + it.qty;
    }
    order.status = 'annulee';
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
      shopEmail: s.shopEmail, shippingFee: s.shippingFee, freeShippingFrom: s.freeShippingFrom,
      gramBuySpread: s.gramBuySpread, gramSellSpread: s.gramSellSpread, buybackSpread: s.buybackSpread,
      minGramTrade: s.minGramTrade, cardEnabled: !!deps.stripe || instantPayments, demo: instantPayments,
    };
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
      cash: 0, goldMg: 0, totpEnabled: false, totpSecret: null, failed: 0, lockedUntil: 0, createdAt: iso(),
    };
    state.users[id] = user;
    state.emailIndex[email] = id;
    addLedger(user, { type: 'ouverture', label: 'Ouverture du compte', amount: 0 });
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
        if (user.failed >= 5) { user.lockedUntil = now() + 15 * 60000; user.failed = 0; }
        save();
      }
      fail(401, 'E-mail ou mot de passe incorrect.');
    }
    if (user.totpEnabled) {
      if (!body.code) return { data: { need2fa: true } };
      limit('totp:' + user.id, 10, 900000);
      if (!(await verifyTotp(deps, user.totpSecret, body.code))) fail(401, 'Code de double authentification incorrect.');
    }
    user.failed = 0; user.lockedUntil = 0; user.lastLogin = iso();
    const token = await openSession(user);
    save();
    return { token, data: { user: publicUser(user, state.sessions[await deps.sha256(token)].csrf) } };
  });

  route('POST', '/api/auth/logout', { auth: true }, ({ auth }) => {
    delete state.sessions[auth.key];
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
    save();
    return { ok: true };
  });

  route('POST', '/api/auth/profile', { auth: true }, ({ auth, body }) => {
    const u = auth.user;
    const phone = str(body.phone, 30), address = str(body.address, 200), zip = str(body.zip, 12), city = str(body.city, 80);
    if (!/^[+\d][\d\s.-]{7,}$/.test(phone)) fail(400, 'Numéro de téléphone invalide.');
    if (!address || !zip || !city) fail(400, 'Adresse complète obligatoire.');
    Object.assign(u, { phone, address, zip, city, country: str(body.country || u.country, 60) });
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
    save();
    return { ok: true };
  });

  route('POST', '/api/auth/2fa/disable', { auth: true }, async ({ auth, body }) => {
    const u = auth.user;
    if (!(await deps.verifyPassword(String(body.password || ''), u.passHash))) fail(401, 'Mot de passe incorrect.');
    if (!(await verifyTotp(deps, u.totpSecret, body.code))) fail(401, 'Code incorrect.');
    u.totpEnabled = false; u.totpSecret = null;
    save();
    return { ok: true };
  });

  // --- Espace client ---
  route('GET', '/api/account', { auth: true }, ({ auth }) => {
    const u = auth.user;
    const spot = displaySpot();
    const v = vaultOf(u.id);
    const vault = Object.entries(v).filter(([, q]) => q > 0).map(([id, qty]) => {
      const p = product(id);
      const pp = spot && spot.eur ? publicProduct(p, spot) : p;
      return { product: pp, qty, value: pp.metalValue ? pp.metalValue * qty : 0, buyback: pp.buyback ? pp.buyback * qty : 0 };
    });
    const vaultGoldMg = vault.filter((x) => x.product.metal === 'or').reduce((a, x) => a + Math.round(x.product.fine * 1000) * x.qty, 0);
    const gram = spot && spot.eur ? perGram(spot, 'or') : 0;
    return {
      user: publicUser(u, auth.session.csrf),
      cash: u.cash,
      goldMg: u.goldMg,
      goldValue: Math.round(u.goldMg / 1000 * gram * 100),
      vault,
      vaultGoldMg,
      vaultValue: vault.reduce((a, x) => a + x.value, 0),
      totalGoldMg: u.goldMg + vaultGoldMg,
      totalGoldValue: Math.round((u.goldMg + vaultGoldMg) / 1000 * gram * 100),
      ledger: state.ledger.filter((l) => l.userId === u.id).slice(-100).reverse(),
      orders: state.orders.filter((o) => o.userId === u.id).slice().reverse(),
      deposits: state.deposits.filter((d) => d.userId === u.id).slice().reverse(),
      withdrawals: state.withdrawals.filter((w) => w.userId === u.id).slice().reverse(),
    };
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
    u.cash -= cost; u.goldMg += mg;
    addLedger(u, { type: 'achat_or', label: `Achat de ${(mg / 1000).toLocaleString('fr-FR')} g d'or à ${eur(unit)}/g`, amount: -cost, goldMg: mg, unit });
    save();
    return { ok: true, mg, cost, unit };
  });

  route('POST', '/api/wallet/sell-gold', { auth: true }, ({ auth, body }) => {
    const u = auth.user, s = S();
    const spot = liveSpot();
    const unit = gramSellCents(spot, s);
    checkMove(unit, body.expected, 'sell');
    const mg = body.all ? u.goldMg : Math.floor(positiveNumber(body.grams, 'Quantité') * 1000);
    if (mg <= 0) fail(400, 'Vous n\'avez pas d\'or sur votre compte.');
    if (mg < s.minGramTrade * 1000 && mg !== u.goldMg) fail(400, `Minimum ${String(s.minGramTrade).replace('.', ',')} g par opération.`);
    if (mg > u.goldMg) fail(400, `Vous n'avez que ${(u.goldMg / 1000).toLocaleString('fr-FR')} g d'or sur votre compte.`);
    const proceeds = Math.floor(mg * unit / 1000);
    u.goldMg -= mg; u.cash += proceeds;
    addLedger(u, { type: 'vente_or', label: `Vente de ${(mg / 1000).toLocaleString('fr-FR')} g d'or à ${eur(unit)}/g`, amount: proceeds, goldMg: -mg, unit });
    save();
    return { ok: true, mg, proceeds, unit };
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
    u.cash -= cost;
    setOverride(p.id, { stock: p.stock - qty });
    const v = vaultOf(u.id);
    v[p.id] = (v[p.id] || 0) + qty;
    addLedger(u, { type: 'achat_produit', label: `Achat ${qty} × ${p.name} (gardé au coffre)`, amount: -cost, productId: p.id, qty, unit });
    save();
    return { ok: true, cost, unit };
  });

  route('POST', '/api/wallet/sell-product', { auth: true }, ({ auth, body }) => {
    const u = auth.user;
    const p = product(str(body.productId, 80));
    if (!p) fail(404, 'Produit introuvable.');
    const qty = intQty(body.qty);
    const v = vaultOf(u.id);
    if ((v[p.id] || 0) < qty) fail(400, 'Vous n\'avez pas cette quantité au coffre.');
    const spot = liveSpot();
    const unit = buybackCents(p, spot, S());
    checkMove(unit, body.expected, 'sell');
    const proceeds = unit * qty;
    v[p.id] -= qty;
    u.cash += proceeds;
    setOverride(p.id, { stock: (p.stock || 0) + qty });
    addLedger(u, { type: 'vente_produit', label: `Revente ${qty} × ${p.name}`, amount: proceeds, productId: p.id, qty, unit });
    save();
    return { ok: true, proceeds, unit };
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
      return { id: p.id, name: p.name, qty, unit: 0 };
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
    if (method === 'carte') {
      if (instantPayments) {
        validateDeposit(dep);
        save();
        return { deposit: dep, instant: true };
      }
      if (!deps.stripe) fail(400, 'Le paiement par carte n\'est pas encore activé : utilisez le virement.');
      const session = await deps.stripe.checkout({
        amount, description: `Versement sur compte ${u.clientNo}`, ref: dep.ref, kind: 'deposit', email: u.email,
        successUrl: `${origin}/#/compte?paiement=ok`, cancelUrl: `${origin}/#/compte?paiement=annule`,
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
  }

  route('POST', '/api/wallet/withdraw', { auth: true }, async ({ auth, body }) => {
    const u = auth.user;
    if (!(await deps.verifyPassword(String(body.password || ''), u.passHash))) fail(401, 'Mot de passe incorrect.');
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
    const out = { order };
    if (payment === 'solde') {
      u.cash -= total;
      addLedger(u, { type: 'commande', label: `Commande ${order.ref}`, amount: -total, ref: order.ref });
      applyPaid(order, 'solde');
    } else if (payment === 'carte') {
      if (instantPayments) {
        applyPaid(order, 'carte');
      } else {
        const session = await deps.stripe.checkout({
          amount: total, description: `Commande ${order.ref}`, ref: order.ref, kind: 'order', email: u.email,
          successUrl: `${origin}/#/commande/${order.ref}?paiement=ok`, cancelUrl: `${origin}/#/commande/${order.ref}?paiement=annule`,
        });
        order.stripeSession = session.id;
        out.redirect = session.url;
      }
    } else {
      out.bank = { holder: s.bankHolder, iban: s.bankIban, bic: s.bankBic, ref: order.ref };
    }
    save();
    return out;
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
    if (o.status !== 'en_attente_paiement') fail(400, 'Cette commande ne peut plus être annulée en ligne : contactez-nous.');
    cancelOrder(o);
    save();
    return { order: o };
  });

  route('POST', '/api/contact', {}, ({ body, ip }) => {
    limit('contact:' + ip, 5, 3600000);
    const msg = {
      name: str(body.name, 120), email: str(body.email, 160), phone: str(body.phone, 30),
      subject: str(body.subject, 160), message: str(body.message, 4000),
    };
    if (!msg.name || !EMAIL_RE.test(msg.email) || msg.message.length < 5) fail(400, 'Merci de renseigner votre nom, un e-mail valide et votre message.');
    state.seq.message++;
    state.messages.push({ id: state.seq.message, ...msg, createdAt: iso(), handled: false });
    save();
    return { ok: true };
  });

  // --- Administration ---
  route('GET', '/api/admin/overview', { admin: true }, () => {
    const spot = displaySpot();
    const users = Object.values(state.users);
    const vaultTotals = {};
    for (const v of Object.values(state.vault)) for (const [id, q] of Object.entries(v)) if (q > 0) vaultTotals[id] = (vaultTotals[id] || 0) + q;
    return {
      stats: {
        users: users.length,
        goldOwedMg: users.reduce((a, u) => a + u.goldMg, 0),
        cashOwed: users.reduce((a, u) => a + u.cash, 0),
        vaultTotals,
        ordersToHandle: state.orders.filter((o) => ['en_attente_paiement', 'payee', 'preparation', 'expediee', 'prete_retrait'].includes(o.status)).length,
      },
      settings: S(),
      products: allProducts().map((p) => (spot && spot.eur ? publicProduct(p, spot) : p)),
      orders: state.orders.slice().reverse().slice(0, 300).map((o) => ({ ...o, client: state.users[o.userId] ? `${state.users[o.userId].firstName} ${state.users[o.userId].lastName} (${state.users[o.userId].clientNo})` : o.email })),
      deposits: state.deposits.slice().reverse().slice(0, 300).map((d) => ({ ...d, client: state.users[d.userId]?.clientNo })),
      withdrawals: state.withdrawals.slice().reverse().slice(0, 300).map((w) => ({ ...w, client: state.users[w.userId]?.clientNo })),
      messages: state.messages.slice().reverse().slice(0, 300),
      users: users.slice().reverse().slice(0, 500).map((u) => ({
        id: u.id, clientNo: u.clientNo, email: u.email, name: `${u.firstName} ${u.lastName}`, phone: u.phone,
        city: u.city, cash: u.cash, goldMg: u.goldMg, role: u.role, totp: !!u.totpEnabled, createdAt: u.createdAt,
      })),
    };
  });

  route('PUT', '/api/admin/products/:id', { admin: true }, ({ params, body }) => {
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
    save();
    return { product: product(p.id) };
  });

  const SETTING_KEYS = {
    gramBuySpread: [0, 0.5], gramSellSpread: [0, 0.5], buybackSpread: [0, 0.5], maxPriceMove: [0, 0.05],
    shippingFee: [0, 100000], freeShippingFrom: [0, 10000000], minGramTrade: [0.001, 100], staleAfterMin: [5, 1440],
  };
  const TEXT_KEYS = ['shopName', 'shopAddress', 'shopHours', 'shopPhone', 'shopEmail', 'bankHolder', 'bankIban', 'bankBic'];
  route('PUT', '/api/admin/settings', { admin: true }, ({ body }) => {
    for (const [k, [min, max]] of Object.entries(SETTING_KEYS)) {
      if (body[k] == null || body[k] === '') continue;
      const v = Number(body[k]);
      if (!Number.isFinite(v) || v < min || v > max) fail(400, `Valeur invalide pour ${k}.`);
      state.settings[k] = v;
    }
    for (const k of TEXT_KEYS) if (body[k] != null) state.settings[k] = str(body[k], 200);
    if (body.fallbackSpot !== undefined) {
      if (!body.fallbackSpot) state.settings.fallbackSpot = null;
      else {
        const f = body.fallbackSpot;
        const fs = { or: Number(f.or), argent: Number(f.argent), platine: Number(f.platine) };
        if (!(fs.or > 0 && fs.argent > 0 && fs.platine > 0)) fail(400, 'Cours de secours invalide.');
        state.settings.fallbackSpot = fs;
      }
    }
    save();
    return { settings: S() };
  });

  route('POST', '/api/admin/orders/:ref/status', { admin: true }, ({ params, body }) => {
    const o = state.orders.find((x) => x.ref === params.ref);
    if (!o) fail(404, 'Commande introuvable.');
    const st = String(body.status || '');
    if (st === 'payee') {
      if (o.status !== 'en_attente_paiement') fail(400, 'Cette commande n\'attend pas de paiement.');
      applyPaid(o, o.payment);
    } else if (st === 'annulee') {
      cancelOrder(o);
    } else if (['preparation', 'expediee', 'prete_retrait', 'livree'].includes(st)) {
      if (!o.paidAt) fail(400, 'Commande non payée.');
      if (o.delivery === 'coffre') fail(400, 'Commande placée au coffre : utilisez une sortie du coffre.');
      o.status = st;
      if (body.tracking != null) o.tracking = str(body.tracking, 120);
      o.updatedAt = iso();
    } else fail(400, 'Statut invalide.');
    save();
    return { order: o };
  });

  route('POST', '/api/admin/deposits/:id/:action', { admin: true }, ({ params }) => {
    const d = state.deposits.find((x) => String(x.id) === params.id);
    if (!d) fail(404, 'Versement introuvable.');
    if (d.status !== 'en_attente') fail(400, 'Versement déjà traité.');
    if (params.action === 'validate') validateDeposit(d);
    else if (params.action === 'refuse') { d.status = 'refusee'; d.validatedAt = iso(); }
    else fail(400, 'Action invalide.');
    save();
    return { deposit: d };
  });

  route('POST', '/api/admin/withdrawals/:id/:action', { admin: true }, ({ params }) => {
    const w = state.withdrawals.find((x) => String(x.id) === params.id);
    if (!w) fail(404, 'Retrait introuvable.');
    if (w.status !== 'en_attente') fail(400, 'Retrait déjà traité.');
    if (params.action === 'done') { w.status = 'effectue'; w.doneAt = iso(); }
    else if (params.action === 'refuse') {
      w.status = 'refuse'; w.doneAt = iso();
      const u = state.users[w.userId];
      u.cash += w.amount;
      addLedger(u, { type: 'retrait_annule', label: `Retrait ${w.ref} refusé : montant recrédité`, amount: w.amount, ref: w.ref });
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
      if (o.status === 'annulee') return false;
      applyPaid(o, 'carte');
    }
    save();
    return true;
  }

  // ---------- Point d'entrée ----------
  async function handle({ method, path, body = {}, token, csrf, ip = 'local', origin = '' }) {
    try {
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
