// Mode démonstration : la logique du serveur tourne dans le navigateur,
// les données restent dans ce navigateur (localStorage). Le cours de l'or
// est quand même réel (relevé en direct). Aucun paiement réel.
import { createCore, emptyState } from './shared/core.js';

const KEY = 'mauriceor-demo-v1';
const PKEY = 'mauriceor-demo-prices';
const TKEY = 'mauriceor-demo-token';
const API = 'https://api.gold-api.com/price';

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

const deps = {
  now: () => Date.now(),
  randomToken: (n) => hex(crypto.getRandomValues(new Uint8Array(n))),
  sha256: async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s))),
  hmacSha1: async (key, msg) => {
    const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
  },
  hashPassword: async (pw) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return `pbkdf2$${hex(salt)}$${await pbkdf2(pw, salt)}`;
  },
  verifyPassword: async (pw, stored) => {
    if (!stored) { await pbkdf2(pw, new Uint8Array(16)); return false; }
    const [, salt, h] = stored.split('$');
    return (await pbkdf2(pw, unhex(salt))) === h;
  },
  adminEmails: ['admin@maurice-or.fr'],
};

async function pbkdf2(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pw).normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256));
}

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

export async function createDemoBackend() {
  const state = load(KEY, null) || emptyState();
  const prices = load(PKEY, { last: null, samples: [] });
  const save = () => store(KEY, state);

  async function refresh() {
    try {
      const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
      const [e, a, pt, g] = await Promise.all([get(`${API}/XAU/EUR`), get(`${API}/XAG/EUR`), get(`${API}/XPT/EUR`), get(`${API}/XAU/GBP`)]);
      const usdOr = e.price / e.exchangeRate;
      prices.last = {
        eur: { or: e.price, argent: a.price, platine: pt.price },
        usd: { or: usdOr },
        gbp: { or: g.price },
        updatedAt: Date.now(),
      };
      const s = prices.samples[prices.samples.length - 1];
      if (!s || Date.now() - s.t > 600000) prices.samples.push({ t: Date.now(), or: e.price });
      prices.samples = prices.samples.filter((x) => Date.now() - x.t < 48 * 3600000);
      store(PKEY, prices);
    } catch {
      // Sans réseau : cours indicatif pour que la démo reste utilisable.
      if (!prices.last) prices.last = { eur: { or: 3570, argent: 48.4, platine: 1400 }, usd: { or: 4000 }, gbp: { or: 2990 }, updatedAt: Date.now(), offline: true };
    }
  }

  function getSpot() {
    if (!prices.last) return null;
    let changePct = null;
    const target = prices.last.updatedAt - 24 * 3600000;
    const ref = prices.samples.reduce((b, x) => (!b || Math.abs(x.t - target) < Math.abs(b.t - target) ? x : b), null);
    if (ref && prices.last.updatedAt - ref.t > 3600000) changePct = prices.last.eur.or / ref.or * 100 - 100;
    // En démo on ne bloque jamais les achats si le relevé a quelques minutes.
    return { ...prices.last, updatedAt: Math.max(prices.last.updatedAt, Date.now() - 60000), changePct };
  }

  await refresh();
  setInterval(refresh, 120000);

  const core = createCore({ state, save, deps, getSpot, instantPayments: true });

  // Comptes de démonstration créés au premier lancement.
  if (!state.seq.user) {
    const base = { birthdate: '1980-05-12', phone: '06 12 34 56 78', address: '8 avenue de l\'Opéra', zip: '75001', city: 'Paris', accept: true };
    await core.handle({ method: 'POST', path: '/api/auth/register', body: { ...base, email: 'admin@maurice-or.fr', password: 'Admin-demo-2026', firstName: 'Maurice', lastName: 'Admin' } });
    await core.handle({ method: 'POST', path: '/api/auth/register', body: { ...base, email: 'client@maurice-or.fr', password: 'Client-demo-2026', firstName: 'Jean', lastName: 'Dupont' } });
    const client = state.users[2];
    client.cash = 500000;
    state.ledger.push({ id: ++state.seq.ledger, userId: 2, at: new Date().toISOString(), type: 'versement', label: 'Versement de bienvenue (démo)', amount: 500000 });
    state.sessions = {};
    save();
  }

  let token = load(TKEY, null);
  let csrf;
  return async (method, path, body) => {
    const out = await core.handle({ method, path, body: body ? JSON.parse(JSON.stringify(body)) : {}, token, csrf, ip: 'demo', origin: location.origin });
    if (out.token !== undefined) { token = out.token; store(TKEY, token); }
    if (out.data && out.data.user && out.data.user.csrf) csrf = out.data.user.csrf;
    return { status: out.status, data: out.data };
  };
}
