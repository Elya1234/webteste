// Serveur Maurice Or : sert le site et l'API sécurisée.
//   npm start                      -> lance le site (port 3000 par défaut)
//   node server/index.js admin a@b.fr  -> donne les droits admin à un compte existant
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCore, emptyState } from '../public/js/shared/core.js';
import { DEFAULT_SETTINGS } from '../public/js/shared/pricing.js';
import { startPrices } from './prices.js';
import { createStripe } from './stripe.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
loadEnv(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const PROD = process.env.NODE_ENV === 'production';
const TRUST_PROXY = process.env.TRUST_PROXY === '1' || PROD;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const COOKIE = 'mo_session';

function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* pas de fichier .env */ }
}

// ---------- Données (fichier JSON écrit de façon atomique + sauvegardes) ----------
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
const STATE_FILE = path.join(DATA_DIR, 'state.json');
let state;
try {
  state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch (e) {
  if (fs.existsSync(STATE_FILE)) {
    console.error('Fichier de données illisible :', STATE_FILE, e.message);
    process.exit(1);
  }
  state = emptyState();
}

function save() {
  const tmp = STATE_FILE + '.tmp';
  const fd = fs.openSync(tmp, 'w', 0o600);
  fs.writeSync(fd, JSON.stringify(state));
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(tmp, STATE_FILE);
}

function backup() {
  if (!fs.existsSync(STATE_FILE)) return;
  const day = new Date().toISOString().slice(0, 10);
  const dest = path.join(DATA_DIR, 'backups', `state-${day}.json`);
  if (!fs.existsSync(dest)) fs.copyFileSync(STATE_FILE, dest);
  const files = fs.readdirSync(path.join(DATA_DIR, 'backups')).filter((f) => f.startsWith('state-')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 60))) fs.unlinkSync(path.join(DATA_DIR, 'backups', f));
}
backup();
setInterval(backup, 3600000).unref();

// ---------- Commande d'administration en ligne de commande ----------
if (process.argv[2] === 'admin') {
  const email = String(process.argv[3] || '').toLowerCase();
  const id = state.emailIndex[email];
  if (!id) { console.error('Aucun compte avec cet e-mail. Créez-le d\'abord sur le site.'); process.exit(1); }
  state.users[id].role = 'admin';
  save();
  console.log(`${email} est maintenant administrateur.`);
  process.exit(0);
}

// ---------- Sécurité ----------
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY = 'scrypt$' + crypto.randomBytes(16).toString('hex') + '$' + crypto.randomBytes(64).toString('hex');
const deps = {
  now: () => Date.now(),
  randomToken: (n) => crypto.randomBytes(n).toString('hex'),
  sha256: async (s) => crypto.createHash('sha256').update(s).digest('hex'),
  hmacSha1: async (key, msg) => new Uint8Array(crypto.createHmac('sha1', key).update(msg).digest()),
  hashPassword: (pw) => new Promise((ok, ko) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(pw.normalize('NFKC'), salt, 64, SCRYPT, (err, key) => (err ? ko(err) : ok(`scrypt$${salt.toString('hex')}$${key.toString('hex')}`)));
  }),
  verifyPassword: (pw, stored) => new Promise((ok) => {
    const [, saltHex, hashHex] = String(stored || DUMMY).split('$');
    crypto.scrypt(String(pw).normalize('NFKC'), Buffer.from(saltHex, 'hex'), 64, SCRYPT, (err, key) => {
      if (err) return ok(false);
      ok(!!stored && crypto.timingSafeEqual(key, Buffer.from(hashHex, 'hex')));
    });
  }),
  adminEmails: ADMIN_EMAILS,
  stripe: createStripe(process.env.STRIPE_SECRET_KEY),
};

const settings = () => ({ ...DEFAULT_SETTINGS, ...state.settings });
const { getSpot, getHistory } = startPrices(DATA_DIR, settings);
const core = createCore({ state, save, deps, getSpot, getHistory });

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://s3.tradingview.com https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "frame-src https://*.tradingview.com https://www.tradingview-widget.com https://s.tradingview.com",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function securityHeaders(res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readBody(req, limit = 100 * 1024) {
  return new Promise((ok, ko) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { ko(Object.assign(new Error('trop gros'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', ko);
  });
}

function send(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data ?? {});
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(body);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Page introuvable');
    }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': st.size,
      'Cache-Control': rel === '/index.html' ? 'no-cache' : 'public, max-age=300',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || 'inconnu';
}

function originOf(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = TRUST_PROXY && req.headers['x-forwarded-proto'] ? String(req.headers['x-forwarded-proto']).split(',')[0] : 'http';
  return `${proto}://${req.headers.host}`;
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/stripe/webhook' && req.method === 'POST') {
      const raw = await readBody(req, 512 * 1024);
      const event = deps.stripe && deps.stripe.verifyWebhook(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
      if (!event) return send(res, 400, { error: 'signature invalide' });
      if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
        const s = event.data.object;
        core.cardPaid(s.metadata.kind, s.metadata.ref, s.amount_total);
      }
      return send(res, 200, { received: true });
    }

    if (url.pathname.startsWith('/api/')) {
      let body = {};
      if (req.method === 'POST' || req.method === 'PUT') {
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'Format non accepté.' });
        const raw = await readBody(req);
        try { body = raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch { return send(res, 400, { error: 'Requête invalide.' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
      } else if (req.method !== 'GET') {
        return send(res, 405, { error: 'Méthode non autorisée.' });
      }
      const cookies = parseCookies(req.headers.cookie);
      const out = await core.handle({
        method: req.method, path: url.pathname, body, token: cookies[COOKIE],
        csrf: req.headers['x-csrf-token'], ip: clientIp(req), origin: originOf(req),
      });
      const headers = {};
      const secure = PROD || process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
      if (out.token) headers['Set-Cookie'] = `${COOKIE}=${out.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${7 * 86400}${secure}`;
      else if (out.token === null) headers['Set-Cookie'] = `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
      return send(res, out.status, out.data, headers);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    serveStatic(req, res, url.pathname);
  } catch (e) {
    if (e.status === 413) return send(res, 413, { error: 'Requête trop volumineuse.' });
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Erreur interne.' });
  }
});

server.listen(PORT, () => {
  console.log(`Maurice Or en ligne sur http://localhost:${PORT}`);
  if (!deps.stripe) console.log('Paiement carte désactivé (STRIPE_SECRET_KEY absent) : virement et solde disponibles.');
});
