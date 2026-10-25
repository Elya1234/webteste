// Tests de la logique métier (comptes, portefeuille, commandes, admin).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createCore, emptyState } from '../public/js/shared/core.js';

function setup(spotOverride, settings = { approvalBuy: false }) {
  const state = emptyState();
  state.settings = { ...settings };
  let now = Date.UTC(2026, 9, 25, 12);
  const spot = { eur: { or: 3110.35, argent: 31.1, platine: 1000 }, usd: { or: 3500 }, gbp: { or: 2600 }, updatedAt: now };
  const deps = {
    now: () => now,
    randomToken: (n) => crypto.randomBytes(n).toString('hex'),
    sha256: async (s) => crypto.createHash('sha256').update(s).digest('hex'),
    hmacSha1: async (k, m) => new Uint8Array(crypto.createHmac('sha1', k).update(m).digest()),
    hashPassword: async (pw) => 'h$' + crypto.createHash('sha256').update(pw).digest('hex'),
    verifyPassword: async (pw, h) => !!h && h === 'h$' + crypto.createHash('sha256').update(pw).digest('hex'),
    adminEmails: ['admin@x.fr'],
  };
  const core = createCore({ state, save: () => {}, deps, getSpot: () => ({ ...spot, ...spotOverride }) });
  const sessions = {};
  async function call(who, method, path, body) {
    const s = sessions[who] || {};
    const out = await core.handle({ method, path, body, token: s.token, csrf: s.csrf, ip: who });
    if (out.token) sessions[who] = { token: out.token, csrf: out.data.user.csrf };
    return out;
  }
  const reg = (who, email) => call(who, 'POST', '/api/auth/register', { email, password: 'motdepasse123', firstName: 'A', lastName: 'B', birthdate: '1980-01-01', phone: '0612345678', address: '1 rue', zip: '75001', city: 'Paris', accept: true });
  return { state, core, call, reg, spot, advance: (ms) => { now += ms; spot.updatedAt = now; }, now: () => now };
}

test('inscription, connexion, verrouillage', async () => {
  const t = setup();
  assert.equal((await t.reg('c', 'c@x.fr')).status, 201);
  assert.equal((await t.reg('c2', 'c@x.fr')).status, 409);
  assert.equal((await t.call('z', 'POST', '/api/auth/register', { email: 'y@x.fr', password: 'court' })).status, 400);
  for (let i = 0; i < 5; i++) assert.equal((await t.call('z', 'POST', '/api/auth/login', { email: 'c@x.fr', password: 'faux-mot-de-passe1' })).status, 401);
  assert.equal((await t.call('z', 'POST', '/api/auth/login', { email: 'c@x.fr', password: 'motdepasse123' })).status, 429);
});

test('CSRF exigé sur les actions', async () => {
  const t = setup();
  await t.reg('c', 'c@x.fr');
  const r = await t.core.handle({ method: 'POST', path: '/api/wallet/buy-gold', body: { grams: 1 }, token: undefined });
  assert.equal(r.status, 401);
  const reg = await t.call('d', 'POST', '/api/auth/login', { email: 'c@x.fr', password: 'motdepasse123' });
  const forged = await t.core.handle({ method: 'POST', path: '/api/auth/logout', body: {}, token: reg.token, csrf: 'faux' });
  assert.equal(forged.status, 403);
});

test('versement par virement validé par l\'admin, achat et vente au gramme', async () => {
  const t = setup();
  await t.reg('admin', 'admin@x.fr');
  await t.reg('c', 'c@x.fr');
  const dep = await t.call('c', 'POST', '/api/wallet/deposit', { amount: 1000, method: 'virement' });
  assert.equal(dep.status, 200);
  assert.equal((await t.call('c', 'POST', '/api/admin/deposits/1/validate')).status, 403);
  assert.equal((await t.call('admin', 'POST', '/api/admin/deposits/1/validate')).status, 200);
  let acc = (await t.call('c', 'GET', '/api/account')).data;
  assert.equal(acc.cash, 100000);
  // 100 €/g au cours, achat à +1,5 % = 101,50 €/g
  const buy = await t.call('c', 'POST', '/api/wallet/buy-gold', { grams: 2, expected: 10150 });
  assert.equal(buy.status, 200, JSON.stringify(buy.data));
  assert.equal(buy.data.amount, 20300);
  acc = (await t.call('c', 'GET', '/api/account')).data;
  assert.equal(acc.goldMg, 2000);
  assert.equal(acc.cash, 100000 - 20300);
  assert.equal((await t.call('c', 'POST', '/api/wallet/sell-gold', { grams: 3 })).status, 400);
  const sell = await t.call('c', 'POST', '/api/wallet/sell-gold', { grams: 1, expected: 9850 });
  assert.equal(sell.data.amount, 9850);
  assert.equal((await t.call('c', 'POST', '/api/wallet/buy-gold', { grams: 100 })).status, 400);
});

test('le prix est refusé si le cours a bougé', async () => {
  const t = setup();
  await t.reg('c', 'c@x.fr');
  t.state.users[1].cash = 100000;
  const r = await t.call('c', 'POST', '/api/wallet/buy-gold', { grams: 1, expected: 9000 });
  assert.equal(r.status, 409);
  assert.equal(r.data.price, 10150);
});

test('cours périmé : transactions bloquées', async () => {
  const t = setup({ updatedAt: Date.UTC(2026, 9, 25, 10) });
  await t.reg('c', 'c@x.fr');
  t.state.users[1].cash = 100000;
  assert.equal((await t.call('c', 'POST', '/api/wallet/buy-gold', { grams: 1 })).status, 503);
});

test('commande payée par solde au coffre, revente, livraison', async () => {
  const t = setup();
  await t.reg('c', 'c@x.fr');
  t.state.users[1].cash = 1000000;
  const o = await t.call('c', 'POST', '/api/orders', { items: [{ id: 'lingot-or-10g', qty: 2 }], delivery: 'coffre', payment: 'solde' });
  assert.equal(o.status, 200, JSON.stringify(o.data));
  assert.equal(o.data.order.status, 'au_coffre');
  let acc = (await t.call('c', 'GET', '/api/account')).data;
  assert.equal(acc.vault[0].qty, 2);
  assert.equal(acc.totalGoldMg, 19998);
  const s = await t.call('c', 'POST', '/api/wallet/sell-product', { productId: 'lingot-or-10g', qty: 1 });
  assert.equal(s.status, 200);
  const d = await t.call('c', 'POST', '/api/wallet/deliver', { items: [{ id: 'lingot-or-10g', qty: 1 }], delivery: 'boutique' });
  assert.equal(d.status, 200, JSON.stringify(d.data));
  acc = (await t.call('c', 'GET', '/api/account')).data;
  assert.equal(acc.vault.length, 0);
  assert.equal((await t.call('c', 'POST', '/api/wallet/deliver', { items: [{ id: 'lingot-or-10g', qty: 1 }], delivery: 'boutique' })).status, 400);
});

test('commande par virement, stock réservé puis rendu à l\'annulation', async () => {
  const t = setup();
  await t.reg('admin', 'admin@x.fr');
  await t.reg('c', 'c@x.fr');
  const before = t.core.product('krugerrand').stock;
  const o = await t.call('c', 'POST', '/api/orders', { items: [{ id: 'krugerrand', qty: 3 }], delivery: 'domicile', payment: 'virement', address: { name: 'A B', address: '1 rue', zip: '75001', city: 'Paris' } });
  assert.equal(o.status, 200, JSON.stringify(o.data));
  assert.equal(t.core.product('krugerrand').stock, before - 3);
  assert.ok(o.data.bank.ref);
  assert.equal((await t.call('admin', 'POST', `/api/admin/orders/${o.data.order.ref}/status`, { status: 'expediee' })).status, 400);
  assert.equal((await t.call('c', 'POST', `/api/orders/${o.data.order.ref}/cancel`)).status, 200);
  assert.equal(t.core.product('krugerrand').stock, before);
  assert.equal((await t.call('c', 'POST', '/api/orders', { items: [{ id: 'krugerrand', qty: 999 }], delivery: 'boutique', payment: 'virement' })).status, 400);
});

test('retrait : mot de passe et IBAN vérifiés, refus recrédite', async () => {
  const t = setup();
  await t.reg('admin', 'admin@x.fr');
  await t.reg('c', 'c@x.fr');
  t.state.users[2].cash = 50000;
  assert.equal((await t.call('c', 'POST', '/api/wallet/withdraw', { amount: 100, iban: 'FR7630006000011234567890189', holder: 'A B', password: 'mauvais' })).status, 401);
  assert.equal((await t.call('c', 'POST', '/api/wallet/withdraw', { amount: 100, iban: 'FR7630006000011234567890188', holder: 'A B', password: 'motdepasse123' })).status, 400);
  const w = await t.call('c', 'POST', '/api/wallet/withdraw', { amount: 100, iban: 'FR76 3000 6000 0112 3456 7890 189', holder: 'A B', password: 'motdepasse123' });
  assert.equal(w.status, 200, JSON.stringify(w.data));
  assert.equal(t.state.users[2].cash, 40000);
  await t.call('admin', 'POST', '/api/admin/withdrawals/1/refuse');
  assert.equal(t.state.users[2].cash, 50000);
});

test('double authentification', async () => {
  const t = setup();
  await t.reg('c', 'c@x.fr');
  const s = await t.call('c', 'POST', '/api/auth/2fa/setup');
  assert.equal((await t.call('c', 'POST', '/api/auth/2fa/enable', { code: '000000' })).status, 400);
  // calcule le bon code
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', bytes = [];
  for (const c of s.data.secret) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.UTC(2026, 9, 25, 12) / 30000)));
  const h = crypto.createHmac('sha1', Buffer.from(bytes)).update(msg).digest();
  const o = h[19] & 15;
  const code = String(((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6).padStart(6, '0');
  assert.equal((await t.call('c', 'POST', '/api/auth/2fa/enable', { code })).status, 200);
  const l = await t.call('x', 'POST', '/api/auth/login', { email: 'c@x.fr', password: 'motdepasse123' });
  assert.equal(l.data.need2fa, true);
  assert.equal((await t.call('x', 'POST', '/api/auth/login', { email: 'c@x.fr', password: 'motdepasse123', code })).status, 200);
});

test('deuxième confirmation : achat au gramme validé par l\'admin', async () => {
  const t = setup(undefined, {});
  await t.reg('admin', 'admin@x.fr');
  await t.reg('c', 'c@x.fr');
  const u = t.state.users[2];
  u.cash = 100000;
  const r = await t.call('c', 'POST', '/api/wallet/buy-gold', { grams: 2 });
  assert.equal(r.data.pending, true);
  assert.equal(u.cash, 100000 - 20300);
  assert.equal(u.held, 20300);
  assert.equal(u.goldMg, 0);
  // le client ne peut pas valider lui-même
  assert.equal((await t.call('c', 'POST', `/api/admin/requests/${r.data.request.id}/approve`)).status, 403);
  const ov = await t.call('admin', 'GET', '/api/admin/overview');
  assert.equal(ov.data.stats.toApprove, 1);
  assert.equal((await t.call('admin', 'POST', `/api/admin/requests/${r.data.request.id}/approve`)).status, 200);
  assert.equal(u.goldMg, 2000);
  assert.equal(u.held, 0);
  assert.equal(u.notifs[0].text.includes('validée'), true);
  assert.equal((await t.call('admin', 'POST', `/api/admin/requests/${r.data.request.id}/approve`)).status, 400);
});

test('demande refusée ou expirée : fonds rendus', async () => {
  const t = setup(undefined, {});
  await t.reg('admin', 'admin@x.fr');
  await t.reg('c', 'c@x.fr');
  const u = t.state.users[2];
  u.cash = 100000;
  const stock = t.core.product('lingot-or-10g').stock;
  const a = await t.call('c', 'POST', '/api/wallet/buy-product', { productId: 'lingot-or-10g', qty: 1 });
  assert.equal(t.core.product('lingot-or-10g').stock, stock - 1);
  await t.call('admin', 'POST', `/api/admin/requests/${a.data.request.id}/refuse`, { note: 'stock' });
  assert.equal(u.cash, 100000);
  assert.equal(t.core.product('lingot-or-10g').stock, stock);
  const b = await t.call('c', 'POST', '/api/wallet/buy-gold', { grams: 1 });
  assert.equal(u.held, 10150);
  t.advance(31 * 60000);
  await t.call('c', 'GET', '/api/account');
  assert.equal(t.state.requests.find((x) => x.id === b.data.request.id).status, 'expiree');
  assert.equal(u.cash, 100000);
  assert.equal(u.held, 0);
});

test('commande à valider par l\'admin puis payée par le solde', async () => {
  const t = setup(undefined, {});
  await t.reg('admin', 'admin@x.fr');
  await t.reg('c', 'c@x.fr');
  const u = t.state.users[2];
  u.cash = 1000000;
  const o = await t.call('c', 'POST', '/api/orders', { items: [{ id: '20-fr-coq', qty: 1 }], delivery: 'boutique', payment: 'solde' });
  assert.equal(o.data.order.status, 'a_valider');
  assert.equal(u.held, o.data.order.total);
  await t.call('admin', 'POST', `/api/admin/orders/${o.data.order.ref}/status`, { status: 'valider' });
  const order = t.state.orders[0];
  assert.equal(order.status, 'preparation');
  assert.equal(u.held, 0);
  assert.equal(u.cash, 1000000 - order.total);
});

test('suivi d\'activité : abandons visibles par l\'admin', async () => {
  const t = setup(undefined, {});
  await t.reg('admin', 'admin@x.fr');
  await t.call('v', 'POST', '/api/track', { type: 'cart_add', visitor: 'abc123', data: { id: 'krugerrand', qty: 2, cart: [{ id: 'krugerrand', qty: 2 }] } });
  await t.reg('c', 'c@x.fr');
  await t.call('c', 'POST', '/api/track', { type: 'trade_open', data: { what: 'achat de 5 g', amount: 50000 } });
  assert.equal((await t.call('c', 'POST', '/api/track', { type: 'hack' })).status, 400);
  t.advance(15 * 60000);
  const ov = (await t.call('admin', 'GET', '/api/admin/overview')).data;
  assert.equal(ov.intentions.length, 2);
  assert.ok(ov.intentions.some((i) => i.label.includes('achat de 5 g')));
  assert.ok(ov.events.some((e) => e.type === 'register'));
  // le visiteur qui s'inscrit garde son historique
  const det = (await t.call('admin', 'GET', '/api/admin/users/2')).data;
  assert.ok(det.events.length >= 2);
});
