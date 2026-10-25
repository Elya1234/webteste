// Pages boutique : accueil, pièces, lingots, or au gramme, investir, fiche produit, panier, commande.
import { S, on, price, getCart, addToCart, setCartQty, clearCart, loadProducts, loadPrices, loadMe } from './store.js';
import { post, get } from './api.js';
import { $, $$, esc, eur, num2, gramsNum, toast, modal, busy, FLAG, ICON, date } from './ui.js';
import { productImage, go, live } from './app.js';
import { coinSvg, gramArt } from './art.js';
import { COUNTRIES, METAL_LABEL } from './shared/catalog.js';
import { shippingCents, badgeOf, DEFAULT_SETTINGS } from './shared/pricing.js';
import { ORDER_STATUS } from './shared/core.js';

export const unit = (p, qty = 1) => price(p, qty) ?? p.price;

const fmtWeight = (g) => (g >= 1000 ? `${num2(g / 1000).replace(/,00$/, '')} kg` : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(g)} g`);
const purity = (p) => `${String(p.purity).replace('.', ',')}‰`;

function noPrice() {
  return '<span class="muted">cours en attente</span>';
}

function badgeHtml(p) {
  const b = p.badge || badgeOf(p);
  return `<span class="status status-${b.key}">${b.text.map(esc).join('<br>')}</span>`;
}

// Bouton [-] [quantité au panier] [Ajouter], synchronisé avec le panier.
function cartControl(p) {
  const inCart = getCart().find((x) => x.id === p.id)?.qty || 0;
  const disabled = !p.stock ? ' disabled' : '';
  return `<div class="cartctl" data-cart="${p.id}">
    <button class="cc-minus" aria-label="Retirer un ${esc(p.name)}"${inCart ? '' : ' disabled'}>-</button>
    <input class="cc-qty" type="number" min="0" max="999" inputmode="numeric" value="${inCart}" aria-label="Quantité de ${esc(p.name)} au panier">
    <button class="cc-add"${disabled}>Ajouter</button>
  </div>`;
}

function bindCartControls(root) {
  const sync = () => $$('[data-cart]', root).forEach((box) => {
    const q = getCart().find((x) => x.id === box.dataset.cart)?.qty || 0;
    const input = $('.cc-qty', box);
    if (document.activeElement !== input) input.value = q;
    $('.cc-minus', box).disabled = q === 0;
  });
  const onClick = (e) => {
    const box = e.target.closest('[data-cart]');
    if (!box) return;
    const id = box.dataset.cart;
    const p = S.byId[id];
    const q = getCart().find((x) => x.id === id)?.qty || 0;
    if (e.target.closest('.cc-add')) {
      if (q + 1 > p.stock) return toast(`Stock disponible : ${p.stock}.`, 'err');
      addToCart(id, 1);
      toast(`${p.name} ajouté au panier.`);
    } else if (e.target.closest('.cc-minus')) {
      setCartQty(id, q - 1);
    }
  };
  const onChange = (e) => {
    if (!e.target.classList.contains('cc-qty')) return;
    const id = e.target.closest('[data-cart]').dataset.cart;
    const p = S.byId[id];
    let q = Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0));
    if (q > p.stock) { q = p.stock; toast(`Stock disponible : ${p.stock}.`, 'err'); }
    const had = getCart().some((x) => x.id === id);
    if (had) setCartQty(id, q); else if (q > 0) addToCart(id, q);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  const off = on('cart', sync);
  return () => { off(); root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}

function productRow(p) {
  return `<tr>
    <td class="pt-img"><a href="#/produit/${p.id}">${productImage(p, 'pimg-row')}</a></td>
    <td class="pt-name"><a href="#/produit/${p.id}"><b>${esc(p.name)}</b></a>
      <span class="pt-spec">${fmtWeight(p.weight)} <span>${purity(p)}</span>${p.country ? ` <span class="flag" title="${esc(COUNTRIES[p.country])}">${FLAG[p.country] || ''}</span>` : ''}</span></td>
    <td class="pt-price" data-price="${p.id}">${p.price ? eur(p.price) : noPrice()}</td>
    <td class="pt-info">${badgeHtml(p)}</td>
    <td class="pt-cart">${cartControl(p)}</td>
  </tr>`;
}

export function productTable(list, { head = true, separators = false } = {}) {
  let last = null;
  const rows = list.map((p) => {
    const sep = separators && last && last !== p.category ? '<tr class="pt-sep"><td colspan="5"></td></tr>' : '';
    last = p.category;
    return sep + productRow(p);
  }).join('');
  return `<div class="ptable-wrap"><table class="ptable resp">
    ${head ? '<thead><tr><th colspan="2">Produit d\'investissement</th><th>Prix d\'achat</th><th>Infos</th><th>Ajout au panier</th></tr></thead>' : ''}
    <tbody>${rows}</tbody></table></div>`;
}

function stale() {
  return '<p class="stale-warning" hidden>Le cours n\'a pas pu être actualisé récemment : les achats reprendront dès la prochaine mise à jour.</p>';
}

function spotBar() {
  return `<div class="spotbar">
    <span><b class="gold">Or :</b> once : <b data-live="oz">…</b></span>
    <span>kilo : <b data-live="kilo">…</b></span>
    <span class="hide-sm">24 h : <b data-live="change">—</b></span>
    <span class="spot-upd">Mis à jour automatiquement · <span data-live="updated"></span></span>
  </div>`;
}

let tvSeq = 0;
function chart(el, height = 420) {
  const id = `tv${++tvSeq}`;
  el.innerHTML = `<div class="chart-box" style="height:${height}px">
    <div class="chart-title">Évolution graphique du cours de l'or</div>
    <div class="tradingview-widget-container" id="${id}"><div class="tradingview-widget-container__widget"></div></div>
    <p class="chart-fallback" hidden>Le graphique n'a pas pu se charger. Le cours affiché ci-dessus reste à jour automatiquement.</p>
  </div>`;
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
  s.async = true;
  s.textContent = JSON.stringify({
    symbols: [["Or (€ par once)", 'OANDA:XAUEUR|1M']],
    chartOnly: false, width: '100%', height: '100%', locale: 'fr', colorTheme: 'light', autosize: true,
    showVolume: false, showMA: false, hideDateRanges: false, hideMarketStatus: true, hideSymbolLogo: true,
    scalePosition: 'right', scaleMode: 'Normal', fontFamily: 'Open Sans, sans-serif', fontSize: '11',
    noTimeScale: false, valuesTracking: '1', changeMode: 'price-and-percent', chartType: 'area',
    lineWidth: 2, lineType: 0, dateRanges: ['1d|5', '1m|60', '3m|1D', '12m|1D', '60m|1W', 'all|1M'],
    lineColor: 'rgba(201, 160, 50, 1)', topColor: 'rgba(201, 160, 50, 0.28)', bottomColor: 'rgba(201, 160, 50, 0)',
    backgroundColor: 'rgba(247, 248, 250, 1)', gridLineColor: 'rgba(0, 0, 0, 0.06)',
  });
  s.onerror = () => { $('.chart-fallback', el).hidden = false; };
  $(`#${id}`, el).appendChild(s);
}

// ================= ACCUEIL =================
const FILTERS_KEY = 'mauriceor-home-filters';
export async function home(view) {
  let filters = [];
  try { filters = JSON.parse(sessionStorage.getItem(FILTERS_KEY)) || []; } catch { /* rien */ }
  const gold = S.products.filter((p) => p.homeGold);
  const silver = S.products.filter((p) => p.homeSilver);
  const once = S.byId['lingot-or-once'], kilo = S.byId['lingot-or-1kg'];
  const from = (p) => (p.tiers ? p.tiers[p.tiers.length - 1].unit : p.price);

  view.innerHTML = `
  <section class="home-top">
    <aside class="home-side">
      <h1 class="side-title">Cours de l'or</h1>
      <div class="checks" role="group" aria-label="Afficher">
        ${[['pieces', 'Pièces'], ['gramme', 'Gramme'], ['lingots', 'Lingots']].map(([k, l]) => `
          <label class="gcheck"><input type="checkbox" value="${k}"${filters.includes(k) ? ' checked' : ''}><span class="dot"></span><span>${l}</span></label>`).join('')}
      </div>
      <p class="side-hint">Cochez pour afficher les produits, décochez tout pour revoir le graphique.</p>
    </aside>
    <div class="home-main">
      ${spotBar()}
      ${stale()}
      <div id="home-zone"></div>
    </div>
  </section>

  <section class="home-cards">
    <div class="hcard">
      <div class="hcard-img">${coinSvg({ name: '20 Fr', metal: 'or' })}</div>
      <h2>Pièces d'or</h2>
      <table class="mini">${gold.map((p) => `<tr><th>${esc(p.short)}</th><td>à partir de <span>${p.tiers ? eur(from(p)) : '…'}</span></td><td><button class="btn-green" data-buy="${p.id}">Acheter</button></td></tr>`).join('')}</table>
      <a class="btn-blue" href="#/pieces?metal=or">Toutes nos pièces d'or</a>
      <p class="tiny">Prix basés sur la quantité commandée.</p>
    </div>
    <div class="hcard">
      <div class="hcard-img">${coinSvg({ name: '1 oz', metal: 'argent' })}</div>
      <h2>Pièces d'argent</h2>
      <table class="mini">${silver.map((p) => `<tr><th>${esc(p.short)}</th><td>à partir de <span>${p.tiers ? eur(from(p)) : '…'}</span></td><td><button class="btn-green" data-buy="${p.id}">Acheter</button></td></tr>`).join('')}</table>
      <a class="btn-blue" href="#/pieces?metal=argent">Toutes nos pièces d'argent</a>
      <p class="tiny">Prix basés sur la quantité commandée.</p>
    </div>
    <div class="hcard hcard-rates">
      <div class="rates-head"><button class="rates-refresh" aria-label="Actualiser le cours" data-refresh>⟳</button><h2>Cours de l'Or &amp; Métaux Précieux en €</h2></div>
      <p class="tiny">Mis à jour automatiquement · <span data-live="updated"></span></p>
      <table class="rates">
        <thead><tr><th>Prix en euros</th><th class="y">Or</th><th colspan="2"></th></tr></thead>
        <tbody>
          <tr><th>1 Once</th><td class="y" data-price="lingot-or-once">${once?.price ? eur(once.price) : '…'}</td>
            <td class="q"><label>QTÉ : <input type="number" min="1" max="999" value="1" id="q-once"></label></td><td><button class="btn-green" data-quick="once">Acheter</button></td></tr>
          <tr><th>1 Gramme</th><td class="y" data-live="gram-buy">…</td>
            <td class="q"><label>QTÉ : <input type="number" min="0.1" step="0.1" value="1" id="q-gram"></label></td><td><button class="btn-green" data-quick="gram">Acheter</button></td></tr>
          <tr><th>Lingot 1 KG</th><td class="y" data-price="lingot-or-1kg">${kilo?.price ? eur(kilo.price) : '…'}</td>
            <td class="q"><label>QTÉ : <input type="number" min="1" max="999" value="1" id="q-kilo"></label></td><td><button class="btn-green" data-quick="kilo">Acheter</button></td></tr>
          <tr><th>Variation 24 h</th><td class="y" data-live="change">—</td><td colspan="2"></td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="home-bars">
    ${productTable(S.products.filter((p) => p.home), { head: false })}
  </section>`;

  const zone = $('#home-zone', view);
  const paint = () => {
    if (!filters.length) { chart(zone); return; }
    let html = '';
    if (filters.includes('pieces')) html += `<h2 class="zone-title">Pièces d'or</h2>${productTable(S.products.filter((p) => p.category === 'piece' && p.metal === 'or'))}`;
    if (filters.includes('gramme')) html += `<h2 class="zone-title">Or au gramme</h2>${gramPanel()}`;
    if (filters.includes('lingots')) html += `<h2 class="zone-title">Lingots</h2>${productTable(S.products.filter((p) => p.category === 'lingot'))}`;
    zone.innerHTML = html;
    live(zone);
  };
  paint();

  view.addEventListener('change', (e) => {
    if (!e.target.closest('.gcheck')) return;
    filters = $$('.gcheck input:checked', view).map((i) => i.value);
    try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(filters)); } catch { /* rien */ }
    paint();
  });
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-buy]');
    if (b) { addToCart(b.dataset.buy, 1); toast(`${S.byId[b.dataset.buy].name} ajouté au panier.`); return; }
    const q = e.target.closest('[data-quick]');
    if (q) {
      const k = q.dataset.quick;
      if (k === 'gram') {
        const g = $('#q-gram', view).value;
        go(S.me ? `#/compte?acheter=${encodeURIComponent(g)}` : `#/gramme?g=${encodeURIComponent(g)}`);
        return;
      }
      const id = k === 'once' ? 'lingot-or-once' : 'lingot-or-1kg';
      const n = Math.max(1, parseInt($(k === 'once' ? '#q-once' : '#q-kilo', view).value, 10) || 1);
      addToCart(id, n);
      go('#/panier');
      return;
    }
    if (e.target.closest('[data-refresh]')) {
      await loadPrices(); await loadProducts();
      toast('Cours actualisé.');
    }
  });
  const offProducts = on('products', () => live(view));
  const unbind = bindCartControls(view);
  return () => { unbind(); offProducts(); };
}

function gramPanel() {
  const logged = !!S.me;
  return `<div class="gram-panel">
    <div class="gram-art">${gramArt()}</div>
    <div>
      <p><b>Achetez de l'or au gramme près</b>, dès 0,1 g, sur votre compte poids or. Revendez quand vous voulez au cours du moment.</p>
      <div class="gram-prices">
        <div><span>Vous achetez</span><b data-live="gram-buy">…</b><small>le gramme</small></div>
        <div><span>Vous vendez</span><b data-live="gram-sell">…</b><small>le gramme</small></div>
      </div>
      <a class="btn-dark" href="${logged ? '#/compte' : '#/inscription'}">${logged ? 'Acheter / vendre au gramme' : 'Créer mon compte poids or'}</a>
    </div>
  </div>`;
}

// ================= ACHAT PIÈCES =================
export async function pieces(view, _p, query) {
  let tab = query.metal || 'or';
  const tabs = [['or', 'Pièces d\'or'], ['argent', 'Pièces d\'argent'], ['platine', 'Platine'], ['new', 'Nouveautés'], ['tous', 'Toutes']];
  const list = () => S.products.filter((p) => p.category === 'piece' && (tab === 'tous' || (tab === 'new' ? p.isNew : p.metal === tab)));
  view.innerHTML = `<div class="page page-wide">
    <h1 class="title">Achat pièces</h1>
    ${stale()}
    <div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    <div class="cards-band"><div class="cards" id="cards"></div></div>
    <h2 class="subtitle">Tous les prix en un coup d'œil</h2>
    <div id="ptable"></div>
  </div>`;
  const paint = () => {
    $$('[data-tab]', view).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $('#cards', view).innerHTML = list().map((p) => `
      <article class="pcard">
        <a href="#/produit/${p.id}">${productImage(p)}</a>
        <h3>${esc(p.name)}</h3>
        <p class="pcard-price" data-price="${p.id}">${p.price ? eur(p.price) : ''}</p>
        <a class="btn-outline" href="#/produit/${p.id}">Voir</a>
      </article>`).join('') || '<p class="muted center">Aucune pièce dans cette catégorie pour le moment.</p>';
    $('#ptable', view).innerHTML = productTable(list());
  };
  paint();
  view.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; history.replaceState(null, '', `#/pieces?metal=${tab}`); paint(); }
  });
  return bindCartControls(view);
}

// ================= ACHAT LINGOTS =================
export async function lingots(view) {
  const bars = S.products.filter((p) => p.category === 'lingot');
  view.innerHTML = `<div class="page page-wide">
    <h1 class="title">Achat lingots</h1>
    ${stale()}
    <div class="bar-grid">${bars.map((p) => `
      <article class="bcard">
        <a class="bcard-title ${p.metal === 'argent' ? 'is-silver' : ''}" href="#/produit/${p.id}">${esc(p.name)}</a>
        <a href="#/produit/${p.id}">${productImage(p, 'pimg-bar')}</a>
        <p class="bcard-price" data-price="${p.id}">${p.price ? eur(p.price) : ''}</p>
        <button class="btn-green-lg" data-add="${p.id}"${p.stock ? '' : ' disabled'}>Achat ${esc(p.name)}</button>
      </article>`).join('')}</div>
    <h2 class="subtitle">Tous les lingots</h2>
    ${productTable(bars)}
  </div>`;
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    addToCart(b.dataset.add, 1);
    toast(`${S.byId[b.dataset.add].name} ajouté au panier.`);
  });
  return bindCartControls(view);
}

// ================= ACHAT AU GRAMME =================
export async function gramme(view, _p, query) {
  const cfg = S.config || DEFAULT_SETTINGS;
  view.innerHTML = `<div class="page">
    <h1 class="title">Achat au gramme</h1>
    <p class="lead center">Le <b>compte poids or</b> : vous possédez de l'or physique au gramme près, stocké en sécurité, et vous le revendez en un clic au cours du jour.</p>
    ${stale()}
    <div class="gram-hero">
      <div class="gram-hero-prices">
        <div><span>Cours de l'or</span><b data-live="gram-spot">…</b><small>le gramme</small></div>
        <div class="buy"><span>Vous achetez</span><b data-live="gram-buy">…</b><small>cours + ${num2(cfg.gramBuySpread * 100)} %</small></div>
        <div class="sell"><span>Vous vendez</span><b data-live="gram-sell">…</b><small>cours − ${num2(cfg.gramSellSpread * 100)} %</small></div>
      </div>
      <div class="calc">
        <h2>Calculez</h2>
        <label>Je veux acheter <input type="number" min="0.1" step="0.1" id="calc-g" value="${esc(query.g || '1')}"> gramme(s)</label>
        <p>soit <b id="calc-eur">…</b></p>
        <label>J'ai un budget de <input type="number" min="10" step="10" id="calc-b" value="500"> €</label>
        <p>soit <b id="calc-g2">…</b> d'or</p>
        <a class="btn-dark" href="${S.me ? `#/compte?acheter=${encodeURIComponent(query.g || '1')}` : '#/inscription'}" id="calc-go">${S.me ? 'Acheter maintenant' : 'Créer mon compte poids or'}</a>
      </div>
    </div>
    <ol class="steps">
      <li><b>Créez votre compte</b> sécurisé en 2 minutes (double authentification possible).</li>
      <li><b>Alimentez-le</b> par carte ou virement.</li>
      <li><b>Achetez et vendez au gramme</b>, dès ${String(cfg.minGramTrade).replace('.', ',')} g, au cours en direct.</li>
      <li><b>Récupérez votre or</b> en lingot ou en pièces, livré chez vous ou en boutique — ou revendez-le.</li>
    </ol>
    <h2 class="subtitle">Préférez l'or physique en petites coupures</h2>
    ${productTable(S.products.filter((p) => p.category === 'lingot' && p.metal === 'or' && p.weight <= 20))}
  </div>`;
  const calc = () => {
    const p = S.prices;
    if (!p || !p.available) return;
    const g = Math.max(0, Number($('#calc-g', view).value) || 0);
    const b = Math.max(0, Number($('#calc-b', view).value) || 0);
    $('#calc-eur', view).textContent = eur(Math.round(g * p.gramBuy));
    $('#calc-g2', view).textContent = gramsNum(Math.floor(b * 100 * 1000 / p.gramBuy) / 1000) + ' g';
    if (S.me) $('#calc-go', view).href = `#/compte?acheter=${encodeURIComponent(g)}`;
  };
  calc();
  view.addEventListener('input', calc);
  const off = on('prices', calc);
  const unbind = bindCartControls(view);
  return () => { off(); unbind(); };
}

// ================= INVESTIR DANS L'OR =================
export async function investir(view, _p, query) {
  let sort = query.tri || 'tous';
  const opts = [['tous', 'Tous'], ['lingots-or', 'Lingots Or'], ['pieces-or', 'Pièces Or'], ['lingots-argent', 'Lingots Argent'], ['numismatique', 'Numismatique']];
  const filter = (p) => ({
    tous: true,
    'lingots-or': p.category === 'lingot' && p.metal === 'or',
    'pieces-or': p.category === 'piece' && p.metal === 'or' && !p.isNew,
    'lingots-argent': p.category === 'lingot' && p.metal === 'argent',
    numismatique: p.category === 'piece' && (p.isNew || p.metal !== 'or'),
  }[sort]);
  view.innerHTML = `<div class="page">
    <h1 class="title">Investir dans l'or</h1>
    <p class="lead center">Tous nos produits d'investissement au prix du jour. Les prix suivent le cours de l'or en direct et baissent avec la quantité.</p>
    ${stale()}
    <fieldset class="sorter"><legend>Triez vos produits</legend>
      ${opts.map(([k, l]) => `<label><input type="radio" name="tri" value="${k}"${k === sort ? ' checked' : ''}> ${l}</label>`).join('')}
    </fieldset>
    <div id="inv-table"></div>
  </div>`;
  const paint = () => {
    $('#inv-table', view).innerHTML = productTable(S.products.filter(filter), { separators: true });
  };
  paint();
  view.addEventListener('change', (e) => {
    if (e.target.name !== 'tri') return;
    sort = e.target.value;
    history.replaceState(null, '', `#/investir?tri=${sort}`);
    paint();
  });
  return bindCartControls(view);
}

// ================= GRAPHIQUE DES COURS =================
export async function cours(view) {
  const p = S.prices;
  view.innerHTML = `<div class="page page-wide">
    <h1 class="title">Graphiques des cours</h1>
    ${spotBar()}
    <div id="big-chart"></div>
    <table class="rates rates-wide">
      <thead><tr><th>Métal</th><th>1 gramme</th><th>1 once</th><th>1 kilo</th></tr></thead>
      <tbody>${p && p.available ? ['or', 'argent', 'platine'].map((m) => `<tr><th>${METAL_LABEL[m]}</th><td>${num2(p.gram.eur[m])} €</td><td>${num2(p.oz[m])} €</td><td>${num2(p.gram.eur[m] * 1000)} €</td></tr>`).join('') : '<tr><td colspan="4">Cours en attente…</td></tr>'}</tbody>
    </table>
  </div>`;
  chart($('#big-chart', view), 520);
}

// ================= FICHE PRODUIT =================
export async function productPage(view, { id }) {
  const p = S.byId[id];
  if (!p) { view.innerHTML = '<div class="page"><h1 class="title">Produit introuvable</h1></div>'; return; }
  const cfg = S.config || DEFAULT_SETTINGS;
  const vat = !!p.vat;
  const premium = p.metalValue ? (p.price / p.metalValue - 1) * 100 : null;
  view.innerHTML = `<div class="page page-wide">
    <p class="crumbs"><a href="#/">Accueil</a> › <a href="#/${p.category === 'lingot' ? 'lingots' : 'pieces'}">${p.category === 'lingot' ? 'Lingots' : 'Pièces'}</a> › ${esc(p.name)}</p>
    <h1 class="title">${esc(p.name)}</h1>
    ${stale()}
    <div class="product">
      <div class="product-media">
        ${productImage(p, 'pimg-big')}
        <button class="zoom" aria-label="Agrandir" data-zoom>${ICON.zoom}</button>
      </div>
      <div class="product-specs">
        <dl>
          <dt>Fabricant :</dt><dd>${esc(p.maker || (p.country ? `Monnaie officielle – ${COUNTRIES[p.country]}` : '—'))}</dd>
          <dt>Poids (grammes) :</dt><dd>${num2(p.weight).replace(/,00$/, '')}</dd>
          <dt>Contenu de ${METAL_LABEL[p.metal].toLowerCase()} pur (grammes) :</dt><dd>${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(p.fine)}</dd>
          <dt>Pureté :</dt><dd>${purity(p)}</dd>
          ${p.country ? `<dt>Pays :</dt><dd>${FLAG[p.country] || ''} ${esc(COUNTRIES[p.country])}</dd>` : ''}
          <dt>Stock :</dt><dd>${p.stock > 0 ? `En stock (${p.stock})` : 'Rupture de stock'}</dd>
          <dt>Référence :</dt><dd>${esc(p.id)}</dd>
        </dl>
        <div class="perks">
          <div class="perk"><span class="perk-ico">${ICON.truck}</span><div><b>Livraison gratuite</b> <span class="i" title="Livraison assurée offerte dès ${eur(cfg.freeShippingFrom)}">${ICON.info}</span><small>Livraison entièrement assurée dès ${eur(cfg.freeShippingFrom)}</small></div></div>
          <div class="perk"><span class="perk-ico">${ICON.piggy}</span><div><b>${vat ? 'TVA sur marge incluse' : 'Pas de TVA'}</b><small>${vat ? 'Prix TTC, rien à ajouter' : 'Sur l\'or d\'investissement'}</small></div></div>
          ${p.offer ? `<div class="perk perk-best"><span class="perk-ico">${ICON.piggy}</span><div><b>Meilleure offre</b><small>0 % de commission aujourd'hui</small></div></div>` : `<div class="perk"><span class="perk-ico">${ICON.euro}</span><div><b>Prix transparent</b><small>Valeur métal ${p.metalValue ? eur(p.metalValue) : '…'} · prime ${premium == null ? '…' : num2(premium) + ' %'}</small></div></div>`}
          <div class="perk"><span class="perk-ico">${ICON.shop}</span><div><b>Récupérer en boutique</b><small>Gratuit, sur rendez-vous</small></div></div>
        </div>
      </div>
      <div class="product-buy">
        <div class="buybox">
          <label class="qty-line">QTÉ : <input type="number" min="1" max="999" value="1" id="pq" inputmode="numeric"></label>
          <b class="buy-total" data-price="${p.id}" data-qty-from="#pq" data-total="1">${p.price ? eur(p.price) : ''}</b>
          <button class="btn-buy" id="buy"${p.stock ? '' : ' disabled'}>Acheter</button>
          <p class="tiny center">Prix garanti au moment où vous validez la commande.</p>
        </div>
        <table class="tiers">
          <thead><tr><th>QTÉ</th><th>Net par unité</th><th>TVA par unité</th><th>Brut par unité</th></tr></thead>
          <tbody>${(p.tiers || []).map((t) => `<tr><td>${t.min}+</td><td data-price="${p.id}" data-qty="${t.min}">${eur(t.unit)}</td><td>${vat ? 'incluse' : '0,00 €'}</td><td data-price="${p.id}" data-qty="${t.min}">${eur(t.unit)}</td></tr>`).join('')}</tbody>
        </table>
        ${S.me ? `<p class="tiny">Vous pouvez aussi le garder dans votre <a href="#/compte">coffre</a> et le revendre en un clic (rachat actuel : <b>${p.buyback ? eur(p.buyback) : '…'}</b>).</p>` : ''}
      </div>
    </div>
  </div>`;
  const qty = $('#pq', view);
  view.addEventListener('input', (e) => { if (e.target === qty) live(view); });
  view.addEventListener('click', (e) => {
    if (e.target.closest('#buy')) {
      const n = Math.max(1, Math.min(999, parseInt(qty.value, 10) || 1));
      if (n > p.stock) return toast(`Stock disponible : ${p.stock}.`, 'err');
      addToCart(p.id, n);
      go('#/panier');
    }
    if (e.target.closest('[data-zoom]')) modal(`<div class="zoomed">${productImage(p, 'pimg-zoom')}</div><p class="center"><b>${esc(p.name)}</b></p>`, { wide: true });
  });
}

// ================= PANIER =================
export async function cart(view) {
  const cfg = S.config || DEFAULT_SETTINGS;
  let delivery = sessionStorage.getItem('mo-delivery') || 'domicile';
  let payment = sessionStorage.getItem('mo-payment') || (S.me ? 'solde' : 'virement');
  let account = null;
  let addrDraft = {};
  if (S.me) { try { account = await get('/api/account'); } catch { /* non connecté */ } }

  const paint = () => {
    const lines = getCart().map((l) => {
      const p = S.byId[l.id];
      const u = unit(p, l.qty);
      return { p, qty: l.qty, unit: u, total: u * l.qty };
    });
    if (!lines.length) {
      view.innerHTML = `<div class="page"><h1 class="title">Panier</h1><p class="center lead">Votre panier est vide.</p>
        <p class="center"><a class="btn-dark" href="#/investir">Voir tous les produits</a></p></div>`;
      return;
    }
    if (delivery === 'coffre' && !S.me) delivery = 'domicile';
    const subtotal = lines.reduce((a, x) => a + x.total, 0);
    const ship = shippingCents(subtotal, delivery, cfg);
    const total = subtotal + ship;
    const me = S.me || {};
    const a = (k, fallback) => esc(addrDraft[k] ?? fallback ?? '');
    view.innerHTML = `<div class="page page-wide">
      <h1 class="title">Panier</h1>
      ${stale()}
      <div class="cart">
        <div>
          <div class="ptable-wrap"><table class="ptable cart-table"><thead><tr><th colspan="2">Produit</th><th>Prix unitaire</th><th>Quantité</th><th>Total</th><th></th></tr></thead><tbody>
          ${lines.map((x) => `<tr>
            <td class="pt-img">${productImage(x.p, 'pimg-row')}</td>
            <td class="pt-name"><a href="#/produit/${x.p.id}"><b>${esc(x.p.name)}</b></a><span class="pt-spec">${fmtWeight(x.p.weight)} ${purity(x.p)}</span></td>
            <td class="pt-price">${eur(x.unit)}</td>
            <td><div class="stepper" data-line="${x.p.id}"><button data-d="-1" aria-label="Moins">−</button><input type="number" min="1" max="999" value="${x.qty}" aria-label="Quantité"><button data-d="1" aria-label="Plus">+</button></div></td>
            <td class="pt-price"><b>${eur(x.total)}</b></td>
            <td><button class="link-del" data-del="${x.p.id}" aria-label="Retirer">✕</button></td></tr>`).join('')}
          </tbody></table></div>
          <p class="tiny">Les prix baissent automatiquement avec la quantité et suivent le cours de l'or en direct.</p>

          <h2 class="subtitle left">Livraison</h2>
          <div class="choices">
            ${choice('delivery', 'domicile', delivery, ICON.truck, 'Livraison assurée à domicile', ship === 0 && delivery === 'domicile' ? 'Offerte' : subtotal >= cfg.freeShippingFrom ? 'Offerte' : eur(cfg.shippingFee) + ` (offerte dès ${eur(cfg.freeShippingFrom)})`)}
            ${choice('delivery', 'boutique', delivery, ICON.shop, 'Retrait en boutique', `Gratuit · ${esc(cfg.shopAddress)}`)}
            ${choice('delivery', 'coffre', delivery, ICON.safe, 'Garder au coffre', S.me ? 'Gratuit · stocké pour vous, revendable en 1 clic' : 'Connectez-vous pour utiliser le coffre', !S.me)}
          </div>
          ${delivery === 'domicile' ? `<form class="form grid2" id="addr">
            <label>Nom complet<input name="name" required value="${a('name', me.firstName ? `${me.firstName} ${me.lastName}` : '')}" autocomplete="name"></label>
            <label>Téléphone<input name="phone" value="${a('phone', me.phone)}" autocomplete="tel"></label>
            <label class="span2">Adresse<input name="address" required value="${a('address', me.address)}" autocomplete="street-address"></label>
            <label>Code postal<input name="zip" required value="${a('zip', me.zip)}" autocomplete="postal-code"></label>
            <label>Ville<input name="city" required value="${a('city', me.city)}" autocomplete="address-level2"></label>
          </form>` : ''}

          <h2 class="subtitle left">Paiement</h2>
          <div class="choices">
            ${choice('payment', 'solde', payment, ICON.wallet, 'Solde de mon compte', S.me ? `Disponible : ${account ? eur(account.cash) : '…'}` : 'Connectez-vous pour payer avec votre solde', !S.me)}
            ${choice('payment', 'carte', payment, ICON.card, 'Carte bancaire', S.config?.cardEnabled ? 'Paiement sécurisé 3D Secure' : 'Bientôt disponible', !S.config?.cardEnabled)}
            ${choice('payment', 'virement', payment, ICON.euro, 'Virement bancaire', 'Prix bloqué, commande préparée à réception')}
          </div>
        </div>
        <aside class="summary">
          <h2>Récapitulatif</h2>
          <dl><dt>Sous-total</dt><dd>${eur(subtotal)}</dd><dt>Livraison</dt><dd>${ship ? eur(ship) : 'Offerte'}</dd><dt class="tot">Total</dt><dd class="tot">${eur(total)}</dd></dl>
          <p class="tiny">${lines.some((x) => !x.p.vat) ? 'Or d\'investissement exonéré de TVA. ' : ''}${lines.some((x) => x.p.vat) ? 'Argent et platine : TVA sur marge incluse.' : ''}</p>
          <button class="btn-buy" id="checkout">${S.me ? 'Valider la commande' : 'Se connecter pour commander'}</button>
          <p class="tiny center">${ICON.lock.replace('<svg', '<svg class="inline-ico"')} Paiement et données sécurisés</p>
        </aside>
      </div>
    </div>`;
    live(view);
  };
  function choice(name, value, current, icon, label, sub, disabled = false) {
    return `<label class="choice${disabled ? ' is-disabled' : ''}"><input type="radio" name="${name}" value="${value}"${current === value && !disabled ? ' checked' : ''}${disabled ? ' disabled' : ''}>
      <span class="choice-ico">${icon}</span><span><b>${label}</b><small>${sub}</small></span></label>`;
  }
  if (payment === 'solde' && !S.me) payment = 'virement';
  if (payment === 'carte' && !S.config?.cardEnabled) payment = 'virement';
  paint();

  const onClick = async (e) => {
    const step = e.target.closest('[data-d]');
    if (step) {
      const id = step.closest('[data-line]').dataset.line;
      const q = getCart().find((x) => x.id === id).qty + Number(step.dataset.d);
      if (q > S.byId[id].stock) return toast(`Stock disponible : ${S.byId[id].stock}.`, 'err');
      setCartQty(id, Math.max(1, q)); paint(); return;
    }
    const del = e.target.closest('[data-del]');
    if (del) { setCartQty(del.dataset.del, 0); paint(); return; }
    const btn = e.target.closest('#checkout');
    if (!btn) return;
    if (!S.me) { go('#/connexion?next=' + encodeURIComponent('/panier')); return; }
    const items = getCart().map((x) => ({ id: x.id, qty: x.qty }));
    const subtotal = items.reduce((a, x) => a + unit(S.byId[x.id], x.qty) * x.qty, 0);
    const expectedTotal = subtotal + shippingCents(subtotal, delivery, cfg);
    let address = null;
    if (delivery === 'domicile') {
      const f = $('#addr', view);
      if (!f.reportValidity()) return;
      address = Object.fromEntries(new FormData(f));
    }
    await busy(btn, async () => {
      btn.textContent = 'Validation…';
      try {
        const out = await post('/api/orders', { items, delivery, payment, address, expectedTotal });
        clearCart();
        await loadProducts().catch(() => {});
        if (out.redirect) { location.href = out.redirect; return; }
        go(`#/commande/${out.order.ref}`);
      } catch (err) {
        if (err.status === 409 || err.status === 503) { await loadPrices(); await loadProducts().catch(() => {}); paint(); }
        if (err.status === 401) { await loadMe(); go('#/connexion?next=' + encodeURIComponent('/panier')); }
        toast(err.message, 'err');
      }
    });
  };
  const onChange = (e) => {
    if (e.target.name === 'delivery') { delivery = e.target.value; sessionStorage.setItem('mo-delivery', delivery); paint(); }
    else if (e.target.name === 'payment') { payment = e.target.value; sessionStorage.setItem('mo-payment', payment); }
    else if (e.target.closest('[data-line]') && e.target.tagName === 'INPUT') {
      const id = e.target.closest('[data-line]').dataset.line;
      const q = Math.max(1, Math.min(S.byId[id].stock, parseInt(e.target.value, 10) || 1));
      setCartQty(id, q); paint();
    }
  };
  view.addEventListener('click', onClick);
  view.addEventListener('change', onChange);
  view.addEventListener('input', (e) => { if (e.target.closest('#addr')) addrDraft[e.target.name] = e.target.value; });
  const off = on('products', () => { if (!view.contains(document.activeElement) || document.activeElement === document.body) paint(); });
  return () => { off(); };
}

// ================= SUIVI DE COMMANDE =================
export async function orderPage(view, { ref }, query) {
  if (!S.me) { go('#/connexion?next=' + encodeURIComponent(`/commande/${ref}`)); return; }
  const { order: o, bank } = await get(`/api/orders/${encodeURIComponent(ref)}`);
  const DELIV = { domicile: 'Livraison assurée à domicile', boutique: 'Retrait en boutique', coffre: 'Gardé au coffre' };
  const PAY = { solde: 'Solde du compte', carte: 'Carte bancaire', virement: 'Virement bancaire' };
  view.innerHTML = `<div class="page">
    <h1 class="title">Commande ${esc(o.ref)}</h1>
    ${query.paiement === 'ok' && !o.paidAt ? '<p class="info-box">Paiement reçu par notre banque : la confirmation arrive dans quelques secondes. Actualisez la page.</p>' : ''}
    ${query.paiement === 'annule' ? '<p class="error-box">Le paiement a été annulé. Vous pouvez choisir le virement ou réessayer depuis votre compte.</p>' : ''}
    <div class="order-status status-${o.status}">${esc(ORDER_STATUS[o.status] || o.status)}</div>
    <div class="order-grid">
      <div>
        <table class="ptable"><thead><tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>
          ${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${o.kind === 'coffre' ? '—' : eur(i.unit)}</td><td>${o.kind === 'coffre' ? '—' : eur(i.line)}</td></tr>`).join('')}
        </tbody></table>
        <dl class="kv"><dt>Sous-total</dt><dd>${eur(o.subtotal)}</dd><dt>Livraison</dt><dd>${o.shipping ? eur(o.shipping) : 'Offerte'}</dd><dt><b>Total</b></dt><dd><b>${eur(o.total)}</b></dd>
          <dt>Mode</dt><dd>${DELIV[o.delivery]}</dd><dt>Paiement</dt><dd>${PAY[o.payment]}</dd><dt>Passée le</dt><dd>${date(o.createdAt)}</dd>
          ${o.tracking ? `<dt>Suivi colis</dt><dd>${esc(o.tracking)}</dd>` : ''}</dl>
        ${o.address ? `<p><b>Adresse :</b> ${esc(o.address.name)}, ${esc(o.address.address)}, ${esc(o.address.zip)} ${esc(o.address.city)}</p>` : ''}
        ${o.delivery === 'boutique' ? `<p><b>Boutique :</b> ${esc(S.config.shopAddress)} · ${esc(S.config.shopHours)}. Munissez-vous d'une pièce d'identité.</p>` : ''}
      </div>
      ${o.status === 'en_attente_paiement' && o.payment === 'virement' ? `<aside class="summary">
        <h2>Virement à effectuer</h2>
        <dl class="kv"><dt>Montant</dt><dd><b>${eur(o.total)}</b></dd><dt>Bénéficiaire</dt><dd>${esc(bank.holder)}</dd><dt>IBAN</dt><dd class="mono">${esc(bank.iban)}</dd><dt>BIC</dt><dd class="mono">${esc(bank.bic)}</dd><dt>Référence</dt><dd class="mono"><b>${esc(bank.ref)}</b></dd></dl>
        <p class="tiny">Indiquez bien la référence. Votre prix est bloqué ; la commande est préparée dès réception du virement.</p>
        <button class="btn-outline" id="cancel">Annuler la commande</button>
      </aside>` : ''}
    </div>
    <p class="center"><a class="btn-dark" href="#/compte/commandes">Toutes mes commandes</a></p>
  </div>`;
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('#cancel');
    if (!b || !confirm('Annuler cette commande ?')) return;
    await busy(b, async () => {
      try { await post(`/api/orders/${encodeURIComponent(o.ref)}/cancel`); toast('Commande annulée.'); await loadProducts(); go(`#/commande/${o.ref}?keep=1`); }
      catch (err) { toast(err.message, 'err'); }
    });
  });
}
