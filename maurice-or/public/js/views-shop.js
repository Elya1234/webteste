// Pages publiques : accueil, boutique, or au gramme, cours, fiche produit, panier, suivi de commande.
import { S, on, price, getCart, addToCart, setCartQty, clearCart, loadProducts, loadPrices, loadMe } from './store.js';
import { post, get } from './api.js';
import { $, $$, esc, eur, num2, gramsNum, toast, busy, FLAG, ICON, date, time, sparkline, waves, countdown } from './ui.js';
import { productImage, go, live, shopWa } from './app.js';
import { coinSvg, barSvg, gramArt } from './art.js';
import { COUNTRIES, METAL_LABEL } from './shared/catalog.js';
import { shippingCents, badgeOf, DEFAULT_SETTINGS } from './shared/pricing.js';
import { ORDER_STATUS } from './shared/core.js';
import { track } from './track.js';

export const unit = (p, qty = 1) => price(p, qty) ?? p.price;
const cfg = () => S.config || DEFAULT_SETTINGS;

export const fmtWeight = (g) => (g >= 1000 ? `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(g / 1000)} kg` : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(g)} g`);
export const purity = (p) => `${String(p.purity).replace('.', ',')}‰`;
const specs = (p) => `${fmtWeight(p.weight)} · ${purity(p)}${p.country ? ` · ${FLAG[p.country] || ''}` : ''}`;

function badgeChip(p) {
  const b = p.badge || badgeOf(p);
  if (b.key === 'rupture') return '<span class="chip chip-err">Rupture</span>';
  if (b.key === 'offre') return '<span class="chip chip-gold">0 % de commission</span>';
  if (b.key === 'sous') return '<span class="chip chip-gold">Sous la cotation</span>';
  if (p.isNew) return '<span class="chip">Nouveau</span>';
  return '';
}

function stale() {
  return `<div class="notice stale-warning" hidden>${ICON.alert}<span>Le cours n'a pas pu être actualisé récemment : les achats reprennent dès la prochaine mise à jour.</span></div>`;
}

export function pcard(p) {
  return `<article class="pcard">
    <a class="pcard-media" href="#/produit/${p.id}" aria-label="${esc(p.name)}">${productImage(p)}<span class="pcard-badge">${badgeChip(p)}</span></a>
    <h3><a href="#/produit/${p.id}">${esc(p.name)}</a></h3>
    <p class="specs">${specs(p)}</p>
    <div class="pcard-foot">
      <div><span class="price-from">${p.metal === 'or' ? 'Or' : METAL_LABEL[p.metal]} · prix du jour</span><span class="price" data-price="${p.id}">${p.price ? eur(p.price) : '…'}</span></div>
      <button class="add-btn" data-add="${p.id}" aria-label="Ajouter ${esc(p.name)} au panier"${p.stock ? '' : ' disabled'}>${ICON.plus}</button>
    </div>
  </article>`;
}

function lrow(p) {
  const q = getCart().find((x) => x.id === p.id)?.qty || 0;
  return `<div class="lrow">
    <a href="#/produit/${p.id}">${productImage(p)}</a>
    <div class="lrow-name"><a href="#/produit/${p.id}">${esc(p.name)}</a><span>${specs(p)}</span></div>
    <div class="lrow-badge">${badgeChip(p) || '<span class="chip chip-ok">Disponible</span>'}</div>
    <div class="price" data-price="${p.id}">${p.price ? eur(p.price) : '…'}</div>
    <div class="qty-ctl" data-cart="${p.id}"><button class="minus" aria-label="Retirer"${q ? '' : ' disabled'}>−</button><input type="number" min="0" max="999" value="${q}" aria-label="Quantité au panier"><button class="plus" aria-label="Ajouter"${p.stock ? '' : ' disabled'}>+</button></div>
  </div>`;
}

// Boutons « + » et compteurs de quantité synchronisés avec le panier.
function bindCart(root) {
  const sync = () => $$('[data-cart]', root).forEach((box) => {
    const q = getCart().find((x) => x.id === box.dataset.cart)?.qty || 0;
    const input = $('input', box);
    if (document.activeElement !== input) input.value = q;
    $('.minus', box).disabled = q === 0;
  });
  root.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const p = S.byId[add.dataset.add];
      const q = getCart().find((x) => x.id === p.id)?.qty || 0;
      if (q + 1 > p.stock) return toast(`Stock disponible : ${p.stock}.`, 'err');
      addToCart(p.id, 1);
      toast(`${p.name} ajouté au panier.`);
      return;
    }
    const box = e.target.closest('[data-cart]');
    if (!box || e.target.tagName === 'INPUT') return;
    const p = S.byId[box.dataset.cart];
    const q = getCart().find((x) => x.id === p.id)?.qty || 0;
    if (e.target.closest('.plus')) {
      if (q + 1 > p.stock) return toast(`Stock disponible : ${p.stock}.`, 'err');
      addToCart(p.id, 1);
    } else if (e.target.closest('.minus')) setCartQty(p.id, q - 1);
  });
  root.addEventListener('change', (e) => {
    const box = e.target.closest('[data-cart]');
    if (!box || e.target.tagName !== 'INPUT') return;
    const p = S.byId[box.dataset.cart];
    let q = Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0));
    if (q > p.stock) { q = p.stock; toast(`Stock disponible : ${p.stock}.`, 'err'); }
    if (getCart().some((x) => x.id === p.id)) setCartQty(p.id, q); else if (q) addToCart(p.id, q);
  });
  return on('cart', sync);
}

let tvSeq = 0;
function chart(el) {
  const id = `tv${++tvSeq}`;
  el.innerHTML = `<div class="tradingview-widget-container" id="${id}"><div class="tradingview-widget-container__widget"></div></div>
    <p class="chart-fallback" hidden>Le graphique n'a pas pu se charger. Les prix du site restent à jour automatiquement.</p>`;
  const s = document.createElement('script');
  s.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
  s.async = true;
  s.textContent = JSON.stringify({
    symbols: [["Or (€ par once)", 'OANDA:XAUEUR|1M']],
    chartOnly: false, width: '100%', height: '100%', locale: 'fr', colorTheme: 'light', autosize: true,
    showVolume: false, hideDateRanges: false, hideMarketStatus: true, hideSymbolLogo: true,
    scalePosition: 'right', scaleMode: 'Normal', fontFamily: 'Manrope, sans-serif', fontSize: '11',
    valuesTracking: '1', changeMode: 'price-and-percent', chartType: 'area', lineWidth: 2,
    dateRanges: ['1d|5', '1m|60', '3m|1D', '12m|1D', '60m|1W', 'all|1M'],
    lineColor: 'rgba(197, 155, 58, 1)', topColor: 'rgba(197, 155, 58, 0.25)', bottomColor: 'rgba(197, 155, 58, 0)',
    backgroundColor: 'rgba(255, 255, 255, 1)', gridLineColor: 'rgba(0, 0, 0, 0.05)',
  });
  s.onerror = () => { $('.chart-fallback', el).hidden = false; };
  $(`#${id}`, el).appendChild(s);
}

function liveCard() {
  const p = S.prices;
  const hist = p?.history || [];
  return `<div class="live-card">
    <div class="live-top"><span class="live-badge"><span class="dot-live"></span>Cours en direct</span><span>Mis à jour à <span data-live="updated">—</span></span></div>
    <p class="live-price"><span data-live="g-eur">…</span> <small>le gramme</small></p>
    <span class="live-chg" data-live="change"></span> <span class="tiny">sur 24 h</span>
    ${sparkline(hist) || '<div style="height:20px"></div>'}
    <div class="live-grid">
      <div><span>Once (31,1 g)</span><b data-live="oz">…</b></div>
      <div><span>Kilo</span><b data-live="kilo">…</b></div>
      <div class="buy"><span>Vous achetez le gramme</span><b data-live="gram-buy">…</b></div>
      <div><span>Vous revendez le gramme</span><b data-live="gram-sell">…</b></div>
    </div>
    <p class="live-foot">Source : marché international de l'or, relevé automatiquement toutes les 2 minutes.</p>
  </div>`;
}

// ================= ACCUEIL =================
export async function home(view) {
  const fromPrice = (list) => Math.min(...list.filter((p) => p.price).map((p) => p.price));
  const coins = S.products.filter((p) => p.category === 'piece' && p.metal === 'or');
  const bars = S.products.filter((p) => p.category === 'lingot' && p.metal === 'or');
  const popular = ['20-fr-coq', 'lingot-or-once', 'krugerrand', 'lingot-or-10g', 'souverain', 'lingot-or-100g', 'lingot-or-5g', 'philharmonique-argent'].map((id) => S.byId[id]).filter(Boolean);
  const approval = cfg().approvalBuy;
  view.innerHTML = `
  <section class="hero">
    ${waves(700)}
    <div class="hero-inner">
      <div class="hero-copy">
        <p class="eyebrow">Or physique · au cours du jour</p>
        <h1>L'or, <em>simplement</em>.<br>Comme à la banque.</h1>
        <p>Achetez des pièces, des lingots ou quelques grammes d'or. Gardez-les dans votre coffre en ligne, faites-les livrer ou revendez-les en un clic.</p>
        <div class="hero-ctas">
          <a class="btn btn-gold btn-lg" href="${S.me ? '#/espace' : '#/inscription'}">${S.me ? 'Mon espace' : 'Ouvrir mon compte or'}</a>
          <a class="btn btn-ghost btn-lg" href="#/boutique">Voir les produits</a>
        </div>
        <div class="hero-trust">
          <span>${ICON.shield}Chaque achat validé par un conseiller</span>
          <span>${ICON.lock}Compte sécurisé</span>
          <span>${ICON.truck}Livraison assurée</span>
        </div>
      </div>
      ${liveCard()}
    </div>
  </section>

  <section class="section">
    <div class="section-inner">
      <div class="section-head"><div><p class="eyebrow">Trois façons d'investir</p><h2 class="h2">Choisissez votre or</h2></div></div>
      <div class="ways">
        <a class="way" href="#/boutique?cat=pieces"><div class="art-wrap">${coinSvg({ name: '20 Fr', metal: 'or' })}</div>
          <h3>Pièces d'or</h3><p>Napoléon, Krugerrand, Souverain… faciles à revendre à l'unité.</p>
          <div class="way-foot"><div><span>à partir de</span>${coins.length ? eur(fromPrice(coins)) : '…'}</div><span class="arrow">${ICON.arrow}</span></div></a>
        <a class="way" href="#/boutique?cat=lingots"><div class="art-wrap">${barSvg({ name: 'Lingot 100 g', metal: 'or', weight: 100, purity: 999.9, sort: 1 })}</div>
          <h3>Lingots</h3><p>De 1 g à 1 kg, la prime la plus basse pour investir davantage.</p>
          <div class="way-foot"><div><span>à partir de</span>${bars.length ? eur(fromPrice(bars)) : '…'}</div><span class="arrow">${ICON.arrow}</span></div></a>
        <a class="way" href="#/gramme"><div class="art-wrap">${gramArt()}</div>
          <h3>Or au gramme</h3><p>Investissez dès 0,1 g depuis votre téléphone. Revendez quand vous voulez.</p>
          <div class="way-foot"><div><span>le gramme</span><span data-live="gram-buy" style="color:var(--text);font-size:16px">…</span></div><span class="arrow">${ICON.arrow}</span></div></a>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="section-inner">
      <div class="section-head"><div><p class="eyebrow">Comment ça marche</p><h2 class="h2">Quatre étapes, aucune surprise</h2></div></div>
      <div class="steps4">
        <div class="step"><b>Ouvrez votre espace</b><p>En 2 minutes, protégé par mot de passe et, si vous le souhaitez, un code sur votre téléphone.</p></div>
        <div class="step"><b>Alimentez-le</b><p>Par carte ou par virement. Votre solde est visible à tout moment.</p></div>
        <div class="step"><b>Achetez au prix du jour</b><p>${approval ? 'Un conseiller confirme chaque achat : le prix est bloqué pendant la validation.' : 'Le prix affiché est celui que vous payez.'}</p></div>
        <div class="step"><b>Gardez, recevez ou revendez</b><p>Au coffre, livré chez vous, retiré en boutique, ou revendu en un clic.</p></div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="section-inner">
      ${stale()}
      <div class="section-head"><div><p class="eyebrow">Les plus demandés</p><h2 class="h2">Prix en direct</h2></div><a class="btn btn-light" href="#/boutique">Tout voir</a></div>
      <div class="grid-products">${popular.map(pcard).join('')}</div>
    </div>
  </section>

  <section class="section dark-band">
    ${waves(500)}
    <div class="section-inner">
      <div class="section-head"><div><p class="eyebrow">Sécurité</p><h2 class="h2">Votre or est entre de bonnes mains</h2><p class="lead">Nous avons construit Maurice Or comme une banque : chaque opération est contrôlée.</p></div></div>
      <div class="secure-grid">
        <div class="secure-item"><span class="ico">${ICON.shield}</span><b>Double confirmation</b><p>Chaque achat est vérifié et validé par un conseiller avant d'être exécuté.</p></div>
        <div class="secure-item"><span class="ico">${ICON.lock}</span><b>Accès protégé</b><p>Mot de passe chiffré, verrouillage anti-intrusion, code à 6 chiffres sur votre téléphone.</p></div>
        <div class="secure-item"><span class="ico">${ICON.safe}</span><b>Coffre & livraison assurée</b><p>Votre or reste au coffre, ou il est livré assuré, remis contre signature.</p></div>
        <div class="secure-item"><span class="ico">${ICON.euro}</span><b>Prix transparents</b><p>Valeur du métal et marge affichées sur chaque produit. Pas de frais cachés.</p></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="section-inner">
      <div class="section-head"><div><p class="eyebrow">Marché</p><h2 class="h2">L'évolution du cours de l'or</h2></div><a class="btn btn-light" href="#/cours">Tous les cours</a></div>
      <div class="chart-card" id="home-chart"></div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="section-inner">
      <div class="wa-band">
        <div><span class="wa-ico">${ICON.whatsapp}</span><div><h2>Une question ? Un conseiller vous répond sur WhatsApp</h2><p>Avant d'acheter, pour vendre votre or, ou pour prendre rendez-vous en boutique.</p></div></div>
        <a class="btn btn-wa btn-lg" href="${shopWa('j\'ai une question.')}" target="_blank" rel="noopener">${ICON.whatsapp}Écrire sur WhatsApp</a>
      </div>
    </div>
  </section>`;
  chart($('#home-chart', view));
  return bindCart(view);
}

// ================= BOUTIQUE =================
const CATS = [
  ['tout', 'Tout', () => true],
  ['pieces', 'Pièces d\'or', (p) => p.category === 'piece' && p.metal === 'or'],
  ['lingots', 'Lingots d\'or', (p) => p.category === 'lingot' && p.metal === 'or'],
  ['argent', 'Argent & platine', (p) => p.metal !== 'or'],
  ['nouveau', 'Nouveautés', (p) => p.isNew],
];
export async function catalog(view, _p, query) {
  let cat = CATS.some((c) => c[0] === query.cat) ? query.cat : 'tout';
  let mode = query.vue === 'liste' ? 'liste' : 'grille';
  let sort = 'reco';
  const title = () => ({ tout: 'Tous nos produits', pieces: 'Pièces d\'or', lingots: 'Lingots d\'or', argent: 'Argent & platine', nouveau: 'Nouveautés' }[cat]);
  const paint = () => {
    let list = S.products.filter(CATS.find((c) => c[0] === cat)[2]);
    if (sort === 'prix') list = list.slice().sort((a, b) => (a.price || 0) - (b.price || 0));
    if (sort === 'prix-desc') list = list.slice().sort((a, b) => (b.price || 0) - (a.price || 0));
    if (sort === 'gramme') list = list.slice().sort((a, b) => (a.price / a.fine || 0) - (b.price / b.fine || 0));
    view.innerHTML = `<div class="page">
      <div class="page-head"><p class="eyebrow">Boutique · prix en direct</p><h1 class="h1">${title()}</h1>
        <p class="lead">Les prix suivent le cours de l'or en temps réel et baissent automatiquement avec la quantité.</p></div>
      ${stale()}
      <div class="filters">
        <div class="seg" role="tablist">${CATS.map(([k, l]) => `<button role="tab" data-cat="${k}" aria-selected="${k === cat}">${l}</button>`).join('')}</div>
        <select class="input" id="sort" style="width:auto;padding:9px 12px" aria-label="Trier">
          <option value="reco"${sort === 'reco' ? ' selected' : ''}>Recommandés</option><option value="prix"${sort === 'prix' ? ' selected' : ''}>Prix croissant</option>
          <option value="prix-desc"${sort === 'prix-desc' ? ' selected' : ''}>Prix décroissant</option><option value="gramme"${sort === 'gramme' ? ' selected' : ''}>Meilleur prix au gramme</option></select>
        <div class="seg view-toggle"><button data-mode="grille" aria-pressed="${mode === 'grille'}" aria-label="Vue en grille">${ICON.grid}</button><button data-mode="liste" aria-pressed="${mode === 'liste'}" aria-label="Vue en liste">${ICON.list}</button></div>
      </div>
      ${mode === 'grille' ? `<div class="grid-products">${list.map(pcard).join('')}</div>` : `<div class="list-products">${list.map(lrow).join('')}</div>`}
    </div>`;
    live(view);
  };
  paint();
  view.addEventListener('click', (e) => {
    const c = e.target.closest('[data-cat]');
    if (c) { cat = c.dataset.cat; history.replaceState(null, '', `#/boutique?cat=${cat}${mode === 'liste' ? '&vue=liste' : ''}`); paint(); }
    const m = e.target.closest('[data-mode]');
    if (m) { mode = m.dataset.mode; paint(); }
  });
  view.addEventListener('change', (e) => { if (e.target.id === 'sort') { sort = e.target.value; paint(); } });
  return bindCart(view);
}

// ================= OR AU GRAMME =================
export async function gramme(view, _p, query) {
  const c = cfg();
  view.innerHTML = `<div class="page">
    <div class="page-head"><p class="eyebrow">Compte poids or</p><h1 class="h1">L'or au gramme près</h1>
      <p class="lead">Vous possédez de l'or physique dès 0,1 g, stocké en sécurité. Achetez et revendez quand vous voulez, depuis votre espace.</p></div>
    ${stale()}
    <div class="trade">
      <div>
        <div class="choices" style="margin-bottom:18px">
          <div class="choice" style="cursor:default"><span class="choice-ico">${ICON.buy}</span><span><small>Vous achetez le gramme</small><b class="big" data-live="gram-buy">…</b><small>cours + ${num2(c.gramBuySpread * 100)} %</small></span></div>
          <div class="choice" style="cursor:default"><span class="choice-ico">${ICON.sell}</span><span><small>Vous revendez le gramme</small><b class="big" data-live="gram-sell">…</b><small>cours − ${num2(c.gramSellSpread * 100)} %</small></span></div>
        </div>
        <div class="panel">
          <h2 class="h3">Simulez votre achat</h2>
          <div class="amount-field"><input type="number" id="g-eur" min="10" step="10" value="${esc(query.e || '500')}" aria-label="Montant en euros"><span>€</span></div>
          <div class="presets">${[100, 250, 500, 1000, 5000].map((v) => `<button data-v="${v}">${v} €</button>`).join('')}</div>
          <p class="lead" style="margin-top:16px">soit <b id="g-out">…</b> d'or</p>
        </div>
      </div>
      <div class="quote">
        <h3>Comment ça marche</h3>
        <ol class="list" style="color:#d8d3c4">
          <li>Ouvrez votre espace et alimentez votre solde.</li>
          <li>Choisissez un montant en euros ou en grammes.</li>
          <li>${c.approvalBuy ? `Un conseiller valide votre achat (prix bloqué ${c.approvalWindowMin} min).` : 'Votre or est crédité immédiatement.'}</li>
          <li>Revendez à tout moment, ou convertissez en lingot livré chez vous.</li>
        </ol>
        <a class="btn btn-gold btn-block btn-lg" id="g-go" href="${S.me ? '#/espace/acheter' : '#/inscription?next=/espace/acheter'}">${S.me ? 'Acheter de l\'or' : 'Ouvrir mon compte or'}</a>
      </div>
    </div>
  </div>`;
  const calc = () => {
    const p = S.prices;
    if (!p || !p.available) return;
    const e = Math.max(0, Number($('#g-eur', view).value) || 0);
    $('#g-out', view).textContent = gramsNum(Math.floor(e * 100 * 1000 / p.gramBuy) / 1000) + ' g';
    $('#g-go', view).href = S.me ? `#/espace/acheter?e=${e}` : '#/inscription?next=/espace/acheter';
  };
  view.addEventListener('input', calc);
  view.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { $('#g-eur', view).value = b.dataset.v; calc(); } });
  calc();
  return on('prices', calc);
}

// ================= COURS =================
export async function cours(view) {
  const p = S.prices;
  view.innerHTML = `<div class="page">
    <div class="page-head"><p class="eyebrow">Marché des métaux précieux</p><h1 class="h1">Le cours de l'or en direct</h1></div>
    <div class="dash-grid" style="margin-top:0">
      <div class="chart-card" id="big-chart"></div>
      <div class="hero" style="border-radius:22px;padding:0">${liveCard()}</div>
    </div>
    <div class="panel" style="margin-top:22px"><div class="table-wrap"><table class="table">
      <thead><tr><th>Métal</th><th>1 gramme</th><th>1 once</th><th>1 kilo</th></tr></thead>
      <tbody>${p && p.available ? ['or', 'argent', 'platine'].map((m) => `<tr><td><b>${METAL_LABEL[m]}</b></td><td>${num2(p.gram.eur[m])} €</td><td>${num2(p.oz[m])} €</td><td>${num2(p.gram.eur[m] * 1000)} €</td></tr>`).join('') : '<tr><td colspan="4">Cours en attente…</td></tr>'}</tbody>
    </table></div><p class="tiny">Or : ${p && p.available ? `${num2(p.gram.gbp.or)} £ · ${num2(p.gram.usd.or)} $ le gramme` : ''}</p></div>
  </div>`;
  chart($('#big-chart', view));
}

// ================= FICHE PRODUIT =================
export async function productPage(view, { id }) {
  const p = S.byId[id];
  if (!p) { view.innerHTML = '<div class="page"><h1 class="h1">Produit introuvable</h1></div>'; return; }
  const c = cfg();
  track('product_view', { id });
  const premium = p.metalValue ? (p.price / p.metalValue - 1) * 100 : null;
  view.innerHTML = `<div class="page">
    <p class="crumbs"><a href="#/">Accueil</a> › <a href="#/boutique?cat=${p.metal !== 'or' ? 'argent' : p.category === 'lingot' ? 'lingots' : 'pieces'}">${p.category === 'lingot' ? 'Lingots' : 'Pièces'}</a> › ${esc(p.name)}</p>
    ${stale()}
    <div class="product">
      <div class="product-media">${productImage(p)}</div>
      <div>
        ${badgeChip(p)} <span class="chip ${p.stock ? 'chip-ok chip-dot' : 'chip-err'}">${p.stock ? `En stock (${p.stock})` : 'Rupture'}</span>
        <h1>${esc(p.name)}</h1>
        <p class="muted">${specs(p)} · ${esc(p.country ? COUNTRIES[p.country] : p.maker || '')}</p>
        <div class="product-price"><span class="price" data-price="${p.id}" data-qty-from="#pq" data-total="1">${p.price ? eur(p.price) : '…'}</span><span class="muted" id="unit-note"></span></div>
        <p class="tiny">${p.vat ? 'TVA sur marge incluse.' : 'Or d\'investissement : pas de TVA.'} Prix mis à jour en direct.</p>
        <div class="buy-panel">
          <div class="buy-row">
            <div class="qty-ctl"><button class="minus" data-q="-1" aria-label="Moins">−</button><input type="number" id="pq" min="1" max="999" value="1" aria-label="Quantité"><button class="plus" data-q="1" aria-label="Plus">+</button></div>
            <button class="btn btn-ink btn-lg" id="add"${p.stock ? '' : ' disabled'}>${ICON.bag}Ajouter au panier</button>
          </div>
          ${S.me ? `<a class="btn btn-gold btn-block" style="margin-top:10px" id="vault-buy" href="#/espace/acheter?produit=${p.id}">${ICON.safe}Acheter et garder dans mon coffre</a>` : ''}
          <table class="tiers"><thead><tr><th>Quantité</th><th>Prix unitaire</th><th>Économie</th></tr></thead>
            <tbody>${(p.tiers || []).map((t) => `<tr data-min="${t.min}"><td>${t.min} et +</td><td data-price="${p.id}" data-qty="${t.min}">${eur(t.unit)}</td><td>${t.unit < p.price ? '−' + num2((1 - t.unit / p.price) * 100) + ' %' : '—'}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="specs-list">
          <div><span>Poids</span><b>${num2(p.weight).replace(/,00$/, '')} g</b></div>
          <div><span>${METAL_LABEL[p.metal]} pur contenu</span><b>${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(p.fine)} g</b></div>
          <div><span>Pureté</span><b>${purity(p)}</b></div>
          <div><span>${p.country ? 'Pays' : 'Fabricant'}</span><b>${p.country ? `${FLAG[p.country] || ''} ${esc(COUNTRIES[p.country])}` : esc(p.maker || '—')}</b></div>
          <div><span>Valeur du métal</span><b>${p.metalValue ? eur(p.metalValue) : '…'}</b></div>
          <div><span>Marge (prime)</span><b>${premium == null ? '…' : num2(premium) + ' %'}</b></div>
        </div>
        <div class="perks">
          <div class="perk"><span class="ico">${ICON.truck}</span><div><b>Livraison assurée</b><small>Offerte dès ${eur(c.freeShippingFrom)}</small></div></div>
          <div class="perk"><span class="ico">${ICON.shop}</span><div><b>Retrait en boutique</b><small>Gratuit, sur rendez-vous</small></div></div>
          <div class="perk"><span class="ico">${ICON.safe}</span><div><b>Garde au coffre</b><small>Revente en un clic : ${p.buyback ? eur(p.buyback) : '…'}</small></div></div>
          <div class="perk"><span class="ico">${ICON.shield}</span><div><b>Achat confirmé</b><small>Vérifié par un conseiller</small></div></div>
        </div>
        <p style="margin-top:18px"><a class="btn btn-wa btn-sm" href="${shopWa(`je souhaite des informations sur : ${p.name}.`)}" target="_blank" rel="noopener">${ICON.whatsapp}Une question sur ce produit ?</a></p>
      </div>
    </div>
  </div>`;
  const qty = $('#pq', view);
  const refresh = () => {
    const n = Math.max(1, parseInt(qty.value, 10) || 1);
    $$('.tiers tr[data-min]', view).forEach((tr) => tr.classList.remove('is-active'));
    const act = $$('.tiers tr[data-min]', view).filter((tr) => n >= Number(tr.dataset.min)).pop();
    if (act) act.classList.add('is-active');
    $('#unit-note', view).textContent = n > 1 ? `soit ${eur(unit(p, n))} l'unité` : '';
    const vb = $('#vault-buy', view);
    if (vb) vb.href = `#/espace/acheter?produit=${p.id}&qte=${n}`;
    live(view);
  };
  view.addEventListener('input', (e) => { if (e.target === qty) refresh(); });
  view.addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]');
    if (q) { qty.value = Math.max(1, Math.min(999, (parseInt(qty.value, 10) || 1) + Number(q.dataset.q))); refresh(); }
    if (e.target.closest('#add')) {
      const n = Math.max(1, Math.min(999, parseInt(qty.value, 10) || 1));
      if (n > p.stock) return toast(`Stock disponible : ${p.stock}.`, 'err');
      addToCart(p.id, n);
      toast(`${n} × ${p.name} ajouté au panier.`);
    }
  });
  refresh();
}

// ================= PANIER =================
export async function cart(view) {
  const c = cfg();
  let delivery = sessionStorage.getItem('mo-delivery') || 'domicile';
  let payment = sessionStorage.getItem('mo-payment') || (S.me ? 'solde' : 'virement');
  let account = null;
  const addr = {};
  if (S.me) { try { account = await get('/api/account'); } catch { /* non connecté */ } }

  const choice = (name, value, current, icon, label, sub, disabled = false) => `<label class="choice${disabled ? ' is-disabled' : ''}"><input type="radio" name="${name}" value="${value}"${current === value && !disabled ? ' checked' : ''}${disabled ? ' disabled' : ''}>
    <span class="choice-ico">${icon}</span><span><b>${label}</b><small>${sub}</small></span></label>`;

  const paint = () => {
    const lines = getCart().map((l) => { const p = S.byId[l.id]; const u = unit(p, l.qty); return { p, qty: l.qty, unit: u, total: u * l.qty }; });
    if (!lines.length) {
      view.innerHTML = `<div class="page page-mid center"><div class="empty">${ICON.bag}<h1 class="h2">Votre panier est vide</h1><p>Découvrez nos pièces et lingots au prix du jour.</p><a class="btn btn-ink" href="#/boutique">Voir les produits</a></div></div>`;
      return;
    }
    if ((delivery === 'coffre' && !S.me)) delivery = 'domicile';
    if (payment === 'solde' && !S.me) payment = 'virement';
    if (payment === 'carte' && !c.cardEnabled) payment = 'virement';
    const subtotal = lines.reduce((a, x) => a + x.total, 0);
    const ship = shippingCents(subtotal, delivery, c);
    const total = subtotal + ship;
    const me = S.me || {};
    const v = (k, fb) => esc(addr[k] ?? fb ?? '');
    view.innerHTML = `<div class="page">
      <div class="page-head"><h1 class="h1">Mon panier</h1></div>
      ${stale()}
      <div class="cart">
        <div>
          <div class="cart-lines">${lines.map((x) => `<div class="cline">
            ${productImage(x.p)}
            <div class="cline-name"><a href="#/produit/${x.p.id}">${esc(x.p.name)}</a><span>${specs(x.p)} · ${eur(x.unit)} l'unité</span></div>
            <div class="qty-ctl" data-line="${x.p.id}"><button class="minus" data-d="-1" aria-label="Moins">−</button><input type="number" min="1" max="999" value="${x.qty}" aria-label="Quantité"><button class="plus" data-d="1" aria-label="Plus">+</button></div>
            <div class="cline-total">${eur(x.total)}</div>
            <button class="x-btn" data-del="${x.p.id}" aria-label="Retirer">×</button></div>`).join('')}
          </div>
          <h2 class="block-title">1. Comment recevoir votre or ?</h2>
          <div class="choices">
            ${choice('delivery', 'domicile', delivery, ICON.truck, 'Livraison assurée', subtotal >= c.freeShippingFrom ? 'Offerte · remise contre signature' : `${eur(c.shippingFee)} · offerte dès ${eur(c.freeShippingFrom)}`)}
            ${choice('delivery', 'boutique', delivery, ICON.shop, 'Retrait en boutique', 'Gratuit · sur rendez-vous')}
            ${choice('delivery', 'coffre', delivery, ICON.safe, 'Garder au coffre', S.me ? 'Gratuit · revendable en un clic' : 'Connectez-vous pour l\'utiliser', !S.me)}
          </div>
          ${delivery === 'domicile' ? `<form class="form grid2" id="addr" style="margin-top:16px">
            <label>Nom complet<input name="name" required value="${v('name', me.firstName ? `${me.firstName} ${me.lastName}` : '')}" autocomplete="name"></label>
            <label>Téléphone<input name="phone" value="${v('phone', me.phone)}" autocomplete="tel"></label>
            <label class="span2">Adresse<input name="address" required value="${v('address', me.address)}" autocomplete="street-address"></label>
            <label>Code postal<input name="zip" required value="${v('zip', me.zip)}" autocomplete="postal-code"></label>
            <label>Ville<input name="city" required value="${v('city', me.city)}" autocomplete="address-level2"></label>
          </form>` : ''}
          <h2 class="block-title">2. Comment payer ?</h2>
          <div class="choices">
            ${choice('payment', 'solde', payment, ICON.wallet, 'Mon solde', S.me ? `Disponible : ${account ? eur(account.cash) : '…'}` : 'Connectez-vous pour l\'utiliser', !S.me)}
            ${choice('payment', 'carte', payment, ICON.card, 'Carte bancaire', c.cardEnabled ? '3D Secure · après validation' : 'Bientôt disponible', !c.cardEnabled)}
            ${choice('payment', 'virement', payment, ICON.euro, 'Virement', 'Prix bloqué à la commande')}
          </div>
        </div>
        <aside class="summary">
          <h2>Récapitulatif</h2>
          <dl class="kv"><dt>Produits</dt><dd>${eur(subtotal)}</dd><dt>Livraison</dt><dd>${ship ? eur(ship) : 'Offerte'}</dd><dt class="tot">Total</dt><dd class="tot">${eur(total)}</dd></dl>
          ${c.approvalBuy ? `<div class="flow"><span class="on">Commande</span><span>Validation</span><span>Paiement</span><span>Réception</span></div>
          <p class="tiny">${ICON.shield.replace('<svg', '<svg class="inline-ico"')} Un conseiller vérifie et confirme votre commande, en général en quelques minutes. Votre prix est bloqué pendant ${c.approvalWindowMin} min${payment === 'solde' ? ' et le montant est réservé sur votre solde' : ''}.</p>` : ''}
          <button class="btn btn-gold btn-block btn-lg" id="checkout">${S.me ? (c.approvalBuy ? 'Envoyer ma commande' : 'Valider la commande') : 'Se connecter pour commander'}</button>
          <p class="tiny center" style="margin-top:12px">${ICON.lock.replace('<svg', '<svg class="inline-ico"')} Paiement et données sécurisés</p>
        </aside>
      </div>
    </div>`;
    live(view);
  };
  paint();
  track('checkout_start', { amount: getCart().reduce((a, l) => a + unit(S.byId[l.id], l.qty) * l.qty, 0), cart: getCart() });

  view.addEventListener('click', async (e) => {
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
    const expectedTotal = subtotal + shippingCents(subtotal, delivery, c);
    let address = null;
    if (delivery === 'domicile') {
      const f = $('#addr', view);
      if (!f.reportValidity()) return;
      address = Object.fromEntries(new FormData(f));
    }
    await busy(btn, async () => {
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
  });
  view.addEventListener('change', (e) => {
    if (e.target.name === 'delivery') { delivery = e.target.value; sessionStorage.setItem('mo-delivery', delivery); paint(); }
    else if (e.target.name === 'payment') { payment = e.target.value; sessionStorage.setItem('mo-payment', payment); paint(); }
    else if (e.target.closest('[data-line]') && e.target.tagName === 'INPUT') {
      const id = e.target.closest('[data-line]').dataset.line;
      setCartQty(id, Math.max(1, Math.min(S.byId[id].stock, parseInt(e.target.value, 10) || 1))); paint();
    }
  });
  view.addEventListener('input', (e) => { if (e.target.closest('#addr')) addr[e.target.name] = e.target.value; });
  return on('products', () => { if (!view.contains(document.activeElement)) paint(); });
}

// ================= SUIVI DE COMMANDE =================
const DELIV = { domicile: 'Livraison assurée à domicile', boutique: 'Retrait en boutique', coffre: 'Gardé dans votre coffre' };
const PAY = { solde: 'Solde du compte', carte: 'Carte bancaire', virement: 'Virement bancaire' };

function orderFlow(o) {
  const steps = ['Envoyée', 'Validée', 'Payée', o.delivery === 'coffre' ? 'Au coffre' : o.delivery === 'boutique' ? 'Prête' : 'Expédiée', 'Terminée'];
  const lvl = { a_valider: 1, en_attente_paiement: 2, preparation: 3, au_coffre: 5, expediee: 4, prete_retrait: 4, livree: 5 }[o.status] ?? 0;
  if (['annulee', 'refusee', 'expiree'].includes(o.status)) return '';
  return `<div class="flow">${steps.map((s, i) => `<span class="${i < lvl ? 'done' : i === lvl ? 'on' : ''}">${s}</span>`).join('')}</div>`;
}

export async function orderPage(view, { ref }, query) {
  if (!S.me) { go('#/connexion?next=' + encodeURIComponent(`/commande/${ref}`)); return; }
  let { order: o, bank } = await get(`/api/orders/${encodeURIComponent(ref)}`);
  const paint = () => {
    const chip = ['annulee', 'refusee', 'expiree'].includes(o.status) ? 'chip-err' : ['a_valider', 'en_attente_paiement'].includes(o.status) ? 'chip-wait' : 'chip-ok';
    view.innerHTML = `<div class="page page-mid">
      <p class="crumbs"><a href="#/espace/commandes">Mes commandes</a> › ${esc(o.ref)}</p>
      <div class="page-head"><h1 class="h1">Commande ${esc(o.ref)}</h1><span class="chip ${chip} chip-dot">${esc(ORDER_STATUS[o.status] || o.status)}</span></div>
      ${orderFlow(o)}
      ${query.paiement === 'ok' && !o.paidAt ? `<div class="notice notice-info">${ICON.info}<span>Paiement reçu par la banque : la confirmation arrive dans quelques secondes.</span></div>` : ''}
      ${o.status === 'a_valider' ? `<div class="notice">${ICON.clock}<span><b>Un conseiller vérifie votre commande.</b> Votre prix est bloqué jusqu'à ${time(o.expiresAt)} (<span class="timer" data-until="${o.expiresAt}">${countdown(o.expiresAt)}</span>). Vous serez prévenu dès la validation. ${o.payment === 'solde' ? 'Le montant est réservé sur votre solde.' : ''}</span></div>` : ''}
      ${o.status === 'refusee' ? `<div class="notice notice-err">${ICON.info}<span>Votre commande n'a pas été validée${o.note ? ` : ${esc(o.note)}` : ''}. Aucun montant n'a été prélevé.</span></div>` : ''}
      <div class="cart" style="margin-top:20px">
        <div class="panel">
          <ul class="ops">${o.items.map((i) => `<li class="op"><span class="op-ico gold">${S.byId[i.id]?.category === 'lingot' ? ICON.bar : ICON.coins}</span><span class="op-label">${esc(i.name)}<small>Quantité : ${i.qty}</small></span><span class="op-amt">${o.kind === 'coffre' ? '' : eur(i.line)}</span></li>`).join('')}</ul>
          <dl class="kv" style="margin-top:14px"><dt>Livraison</dt><dd>${o.shipping ? eur(o.shipping) : 'Offerte'}</dd><dt class="tot">Total</dt><dd class="tot">${eur(o.total)}</dd></dl>
          <dl class="kv"><dt>Mode</dt><dd>${DELIV[o.delivery]}</dd><dt>Paiement</dt><dd>${PAY[o.payment]}</dd><dt>Date</dt><dd>${date(o.createdAt)}</dd>${o.tracking ? `<dt>Suivi colis</dt><dd>${esc(o.tracking)}</dd>` : ''}</dl>
          ${o.address ? `<p class="small"><b>Adresse :</b> ${esc(o.address.name)}, ${esc(o.address.address)}, ${esc(o.address.zip)} ${esc(o.address.city)}</p>` : ''}
          ${o.delivery === 'boutique' ? `<p class="small"><b>Boutique :</b> ${esc(cfg().shopAddress)} · ${esc(cfg().shopHours)}. Munissez-vous d'une pièce d'identité.</p>` : ''}
        </div>
        <aside class="summary">
          ${o.status === 'en_attente_paiement' && o.payment === 'virement' ? `<h2>Virement à effectuer</h2>
            <dl class="kv"><dt>Montant</dt><dd><b>${eur(o.total)}</b></dd><dt>Bénéficiaire</dt><dd>${esc(bank.holder)}</dd><dt>IBAN</dt><dd class="mono">${esc(bank.iban)}</dd><dt>BIC</dt><dd class="mono">${esc(bank.bic)}</dd><dt>Référence</dt><dd class="mono"><b>${esc(bank.ref)}</b></dd></dl>
            <p class="tiny">Indiquez bien la référence. Votre commande est préparée dès réception.</p>` : ''}
          ${o.status === 'en_attente_paiement' && o.payment === 'carte' ? `<h2>Commande validée</h2><p class="small">Réglez maintenant par carte bancaire pour lancer la préparation.</p><button class="btn btn-gold btn-block btn-lg" id="pay">${ICON.card}Payer ${eur(o.total)}</button>` : ''}
          ${['a_valider', 'en_attente_paiement'].includes(o.status) ? '<button class="btn btn-red btn-block" id="cancel" style="margin-top:12px">Annuler la commande</button>' : ''}
          ${!['a_valider', 'en_attente_paiement'].includes(o.status) ? '<h2>Besoin d\'aide ?</h2><p class="small">Votre conseiller répond sur WhatsApp.</p>' : ''}
          <a class="btn btn-wa btn-block" style="margin-top:12px" href="${shopWa(`à propos de ma commande ${o.ref}.`)}" target="_blank" rel="noopener">${ICON.whatsapp}Écrire à mon conseiller</a>
        </aside>
      </div>
    </div>`;
  };
  paint();
  view.addEventListener('click', async (e) => {
    const c = e.target.closest('#cancel');
    if (c && confirm('Annuler cette commande ? Les fonds réservés seront libérés.')) {
      await busy(c, async () => {
        try { ({ order: o } = await post(`/api/orders/${encodeURIComponent(o.ref)}/cancel`)); toast('Commande annulée.'); await loadProducts(); paint(); }
        catch (err) { toast(err.message, 'err'); }
      });
    }
    const p = e.target.closest('#pay');
    if (p) {
      await busy(p, async () => {
        try {
          const r = await post(`/api/orders/${encodeURIComponent(o.ref)}/pay`);
          if (r.redirect) { location.href = r.redirect; return; }
          o = r.order; toast('Paiement accepté.'); paint();
        } catch (err) { toast(err.message, 'err'); }
      });
    }
  });
  // Tant que la commande attend, on vérifie régulièrement si elle a été validée.
  const timer = setInterval(async () => {
    $$('[data-until]', view).forEach((el) => { el.textContent = countdown(el.dataset.until); });
  }, 1000);
  const poll = setInterval(async () => {
    if (!['a_valider', 'en_attente_paiement'].includes(o.status)) return;
    try {
      const r = await get(`/api/orders/${encodeURIComponent(o.ref)}`);
      if (r.order.status !== o.status) { o = r.order; bank = r.bank; toast(`Commande : ${ORDER_STATUS[o.status]}.`, 'info'); paint(); }
    } catch { /* réseau */ }
  }, 15000);
  return () => { clearInterval(timer); clearInterval(poll); };
}
