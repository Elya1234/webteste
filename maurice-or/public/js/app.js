// Démarrage du site, navigation entre les pages et éléments communs (en-tête, pied de page).
import { initApi, demo } from './api.js';
import { S, on, loadPrices, loadProducts, loadConfig, loadMe, cartCount } from './store.js';
import { $, $$, esc, eur, num2, pct, ICON, toast, waLink } from './ui.js';
import { productArt } from './art.js';
import { track } from './track.js';
import * as shop from './views-shop.js';
import * as espace from './views-espace.js';
import * as admin from './views-admin.js';
import * as info from './views-info.js';

export function productImage(p, cls = '') {
  return `<div class="pimg ${cls}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : productArt(p)}</div>`;
}

// Message WhatsApp pré-rempli avec le numéro client quand il est connecté.
export function shopWa(text) {
  const intro = S.me ? `Bonjour, je suis ${S.me.firstName} ${S.me.lastName} (client ${S.me.clientNo}). ` : 'Bonjour, ';
  return waLink(S.config?.whatsapp, intro + (text || ''));
}

const redirect = (to) => () => { location.replace(to); };
const ROUTES = [
  ['/', shop.home, 'accueil'],
  ['/boutique', shop.catalog, 'boutique'],
  ['/pieces', redirect('#/boutique?cat=pieces')],
  ['/lingots', redirect('#/boutique?cat=lingots')],
  ['/investir', redirect('#/boutique?vue=liste')],
  ['/gramme', shop.gramme, 'gramme'],
  ['/cours', shop.cours, 'cours'],
  ['/produit/:id', shop.productPage, 'boutique'],
  ['/panier', shop.cart, 'panier'],
  ['/commande/:ref', shop.orderPage, 'espace'],
  ['/connexion', espace.loginPage, 'espace'],
  ['/inscription', espace.registerPage, 'espace'],
  ['/espace', espace.espacePage, 'espace', 'app'],
  ['/espace/:tab', espace.espacePage, 'espace', 'app'],
  ['/compte', redirect('#/espace')],
  ['/compte/:tab', redirect('#/espace')],
  ['/admin', admin.adminPage, 'admin', 'app'],
  ['/admin/client/:id', admin.clientPage, 'admin', 'app'],
  ['/admin/:tab', admin.adminPage, 'admin', 'app'],
  ['/contact', info.contact, 'contact'],
  ['/info/:slug', info.infoPage, 'info'],
];

let cleanup = null;
let renderToken = 0;

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

async function render() {
  const { path, query } = parseHash();
  const my = ++renderToken;
  if (cleanup) { try { cleanup(); } catch { /* rien */ } cleanup = null; }
  // une fenêtre ouverte sur la page précédente ne doit pas bloquer la suivante
  $$('.modal-back').forEach((m) => m.remove());
  document.body.classList.remove('no-scroll');
  const view = $('#view');
  for (const [pattern, fn, section, layout] of ROUTES) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    const m = path.match(re);
    if (!m) continue;
    const params = {};
    keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    // Conteneur neuf à chaque page : les écouteurs de la page précédente disparaissent avec lui.
    const root = document.createElement('div');
    root.className = 'view-root';
    root.innerHTML = '<div class="loading">Chargement…</div>';
    view.replaceChildren(root);
    document.body.dataset.page = section || '';
    document.body.dataset.layout = layout || 'site';
    markActive(section, query);
    try {
      const c = await fn(root, params, query);
      if (my !== renderToken) { if (typeof c === 'function') c(); return; }
      cleanup = typeof c === 'function' ? c : null;
    } catch (e) {
      console.error(e);
      if (my === renderToken) root.innerHTML = `<div class="page"><div class="notice notice-err">${esc(e.message || 'Une erreur est survenue.')}</div></div>`;
    }
    if (!query.keep) window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
    paintIcons(view);
    live();
    track('page', { path });
    return;
  }
  view.innerHTML = '<div class="page center"><h1 class="h1">Page introuvable</h1><p><a class="btn btn-ink" href="#/">Retour à l\'accueil</a></p></div>';
}

function markActive(section, query) {
  const nav = section === 'boutique' ? (query.cat === 'lingots' ? 'lingots' : query.cat === 'pieces' ? 'pieces' : '') : section;
  $$('.nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === nav));
  const tab = section === 'gramme' ? 'boutique' : section === 'admin' ? 'espace' : section;
  $$('.tabbar a').forEach((a) => a.classList.toggle('is-active', a.dataset.tab === tab));
}

// Met à jour tous les prix affichés sans recharger la page.
export function live(root = document) {
  const p = S.prices;
  const set = (key, txt) => $$(`[data-live="${key}"]`, root).forEach((el) => { el.textContent = txt; });
  if (p && p.available) {
    set('g-eur', num2(p.gram.eur.or) + ' €');
    set('oz', num2(p.oz.or) + ' €');
    set('kilo', num2(p.kilo.or) + ' €');
    set('gram-buy', eur(p.gramBuy));
    set('gram-sell', eur(p.gramSell));
    set('change', p.changePct == null ? '' : pct(p.changePct));
    set('updated', new Date(p.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    $$('[data-live="change"]', root).forEach((el) => { el.classList.toggle('up', p.changePct > 0); el.classList.toggle('down', p.changePct < 0); });
  }
  $$('[data-price]', root).forEach((el) => {
    const prod = S.byId[el.dataset.price];
    if (!prod || !S.spot) return;
    const qtyEl = el.dataset.qtyFrom ? $(el.dataset.qtyFrom) : null;
    const qty = Math.max(1, parseInt(qtyEl ? qtyEl.value : el.dataset.qty || '1', 10) || 1);
    const unit = shop.unit(prod, qty);
    el.textContent = eur(el.dataset.total ? unit * qty : unit);
  });
  $$('.stale-warning', root).forEach((el) => { el.hidden = !(p && p.stale); });
}

export function paintIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => { if (!el.innerHTML.trim()) el.innerHTML = ICON[el.dataset.icon] || ''; });
}

function updateShell() {
  const n = cartCount();
  $$('[data-cart-count]').forEach((b) => { b.textContent = n; b.hidden = n === 0; });
  const btn = $('#account-btn');
  btn.lastElementChild.textContent = S.me ? (S.me.role === 'admin' ? 'Administration' : 'Mon espace') : 'Se connecter';
  btn.href = S.me && S.me.role === 'admin' ? '#/admin' : '#/espace';
  $$('[data-wa]').forEach((a) => { a.href = shopWa(''); a.target = '_blank'; a.rel = 'noopener'; });
}

async function boot() {
  paintIcons();
  $('#year').textContent = new Date().getFullYear();
  document.addEventListener('click', (e) => {
    if (e.target.closest('a[href^="https://wa.me"]')) track('whatsapp');
  });

  await initApi();
  if (demo) {
    const r = $('#demo-ribbon');
    r.hidden = false;
    r.innerHTML = 'Démonstration : cours de l\'or réel, paiements simulés. Client : <b>client@maurice-or.fr</b> / Client-demo-2026 · Admin : <b>admin@maurice-or.fr</b> / Admin-demo-2026';
  }
  await Promise.all([loadConfig(), loadPrices(), loadMe()]);
  await loadProducts().catch(() => toast('Catalogue indisponible pour le moment.', 'err'));
  updateShell();
  on('cart', updateShell);
  on('me', updateShell);
  on('prices', () => live());
  on('products', () => { updateShell(); live(); });

  window.addEventListener('hashchange', render);
  await render();

  // Le cours est relevé automatiquement : rafraîchissement régulier de l'affichage.
  setInterval(async () => {
    await loadPrices();
    if (document.visibilityState === 'visible') await loadProducts().catch(() => {});
  }, 60000);
}

boot();
