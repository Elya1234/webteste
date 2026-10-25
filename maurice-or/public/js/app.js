// Démarrage du site, navigation entre les pages et éléments communs (en-tête, pied de page).
import { initApi, demo } from './api.js';
import { S, on, loadPrices, loadProducts, loadConfig, loadMe, cartCount } from './store.js';
import { $, $$, esc, eur, num2, pct, ICON, toast } from './ui.js';
import { productArt } from './art.js';
import * as shop from './views-shop.js';
import * as account from './views-account.js';
import * as admin from './views-admin.js';
import * as info from './views-info.js';

export function productImage(p, cls = '') {
  return `<div class="pimg ${cls}">${p.image ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">` : productArt(p)}</div>`;
}

const ROUTES = [
  ['/', shop.home],
  ['/pieces', shop.pieces],
  ['/lingots', shop.lingots],
  ['/gramme', shop.gramme],
  ['/investir', shop.investir],
  ['/cours', shop.cours],
  ['/produit/:id', shop.productPage],
  ['/panier', shop.cart],
  ['/commande/:ref', shop.orderPage],
  ['/compte', account.accountPage],
  ['/compte/:tab', account.accountPage],
  ['/connexion', account.loginPage],
  ['/inscription', account.registerPage],
  ['/admin', admin.adminPage],
  ['/admin/:tab', admin.adminPage],
  ['/contact', info.contact],
  ['/info/:slug', info.infoPage],
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
  closeMenu();
  // une fenêtre ouverte sur la page précédente ne doit pas bloquer la suivante
  $$('.modal-back').forEach((m) => m.remove());
  document.body.classList.remove('no-scroll');
  const view = $('#view');
  for (const [pattern, fn] of ROUTES) {
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
    try {
      const c = await fn(root, params, query);
      if (my !== renderToken) { if (typeof c === 'function') c(); return; }
      cleanup = typeof c === 'function' ? c : null;
    } catch (e) {
      console.error(e);
      if (my === renderToken) root.innerHTML = `<div class="page"><p class="error-box">${esc(e.message || 'Une erreur est survenue.')}</p></div>`;
    }
    document.body.dataset.page = pattern.split('/')[1] || 'accueil';
    if (!query.keep) window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
    live();
    return;
  }
  view.innerHTML = '<div class="page"><h1 class="title">Page introuvable</h1><p class="center"><a class="btn-dark" href="#/">Retour à l\'accueil</a></p></div>';
}

// Met à jour tous les prix affichés sans recharger la page.
export function live(root = document) {
  const p = S.prices;
  const set = (key, txt) => $$(`[data-live="${key}"]`, root).forEach((el) => { el.textContent = txt; });
  if (p && p.available) {
    set('g-eur', num2(p.gram.eur.or) + ' €');
    set('g-gbp', num2(p.gram.gbp.or) + ' £');
    set('g-usd', num2(p.gram.usd.or) + ' $');
    set('oz', num2(p.oz.or) + ' €');
    set('kilo', num2(p.kilo.or) + ' €');
    set('gram-spot', num2(p.gram.eur.or) + ' €');
    set('gram-buy', eur(p.gramBuy));
    set('gram-sell', eur(p.gramSell));
    set('change', p.changePct == null ? '—' : pct(p.changePct));
    set('updated', new Date(p.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }));
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

function paintIcons(root = document) {
  $$('[data-icon]', root).forEach((el) => { if (!el.innerHTML.trim()) el.innerHTML = ICON[el.dataset.icon] || ''; });
}

function updateCartBadge() {
  const n = cartCount();
  const b = $('#cart-count');
  b.textContent = n;
  b.hidden = n === 0;
}

function renderNews() {
  const items = S.products.filter((p) => p.isNew);
  $('#news-track').innerHTML = items.map((p) => `
    <a class="news-item" href="#/produit/${p.id}">
      ${productImage(p)}
      <span class="news-name">${esc(p.name)}</span>
      <span class="news-price" data-price="${p.id}">${p.price ? eur(p.price) : ''}</span>
      <span class="btn-outline">Voir</span>
    </a>`).join('');
}

function closeMenu() {
  document.body.classList.remove('menu-open');
  const b = $('.burger');
  if (b) b.setAttribute('aria-expanded', 'false');
}

async function boot() {
  paintIcons();
  $('.burger').innerHTML = ICON.menu;
  $('#year').textContent = new Date().getFullYear();
  document.addEventListener('click', (e) => {
    const m = e.target.closest('[data-action="menu"]');
    if (m) {
      const open = document.body.classList.toggle('menu-open');
      m.setAttribute('aria-expanded', String(open));
    }
  });

  await initApi();
  if (demo) {
    const r = $('#demo-ribbon');
    r.hidden = false;
    r.innerHTML = 'Mode démonstration : cours de l\'or réel, mais aucun paiement réel. Comptes d\'essai : <b>client@maurice-or.fr</b> / Client-demo-2026 · <b>admin@maurice-or.fr</b> / Admin-demo-2026';
  }
  await Promise.all([loadConfig(), loadPrices(), loadMe()]);
  await loadProducts().catch(() => toast('Catalogue indisponible pour le moment.', 'err'));
  if (S.config) {
    $('#call-btn').href = 'tel:' + S.config.shopPhone.replace(/\s/g, '');
  }
  renderNews();
  updateCartBadge();
  on('cart', updateCartBadge);
  on('me', () => { $$('[data-cta-account]').forEach((a) => { a.innerHTML = S.me ? 'Mon compte<br>poids or' : 'Créez votre compte<br>poids or'; }); });
  on('prices', () => live());
  on('products', () => { renderNews(); updateCartBadge(); live(); });
  $$('[data-cta-account]').forEach((a) => { a.innerHTML = S.me ? 'Mon compte<br>poids or' : 'Créez votre compte<br>poids or'; });

  window.addEventListener('hashchange', render);
  await render();

  // Le cours est relevé automatiquement : rafraîchissement régulier de l'affichage.
  setInterval(async () => {
    await loadPrices();
    if (document.visibilityState === 'visible') await loadProducts().catch(() => {});
  }, 60000);
}

boot();
