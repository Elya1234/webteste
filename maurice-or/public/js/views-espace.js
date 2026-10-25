// Espace client « comme à la banque » : connexion, inscription, vue d'ensemble du
// patrimoine, acheter, vendre, coffre, opérations, commandes, sécurité, profil.
import { S, loadMe, loadPrices, loadProducts } from './store.js';
import { post, get, demo } from './api.js';
import { $, $$, esc, eur, num2, gramsNum, toast, modal, busy, formData, date, ago, ICON, waves, countdown, time } from './ui.js';
import { productImage, go, live, shopWa, paintIcons } from './app.js';
import { ORDER_STATUS, REQUEST_STATUS, REQUEST_KIND } from './shared/core.js';
import { DEFAULT_SETTINGS } from './shared/pricing.js';
import { track, visitorId } from './track.js';
import { fmtWeight, purity } from './views-shop.js';

const mg2g = (mg) => gramsNum(mg / 1000) + ' g';
const cfg = () => S.config || DEFAULT_SETTINGS;
const lockIco = ICON.lock.replace('<svg', '<svg class="inline-ico"');

// ================= CONNEXION =================
function authSide(title) {
  return `<div class="auth-side">${waves(800)}<p class="eyebrow">Maurice Or</p><h2>${title}</h2>
    <ul><li>${ICON.shield}Chaque achat confirmé par un conseiller</li><li>${ICON.lock}Mot de passe chiffré et code de sécurité</li>
    <li>${ICON.safe}Votre or au coffre, livré ou revendu en un clic</li><li>${ICON.whatsapp}Votre conseiller sur WhatsApp</li></ul></div>`;
}

export async function loginPage(view, _p, query) {
  const next = query.next || '/espace';
  if (S.me) { go('#' + (S.me.role === 'admin' && next === '/espace' ? '/admin' : next)); return; }
  view.innerHTML = `<div class="auth-wrap">${authSide('Bon retour<br>parmi nous.')}
    <div class="auth-main"><div class="auth-box">
      <h1 class="h1">Connexion</h1><p class="muted">Accédez à votre espace sécurisé.</p>
      <form class="form" id="login" novalidate style="margin-top:22px">
        <label>Adresse e-mail<input type="email" name="email" required autocomplete="username"></label>
        <label>Mot de passe<input type="password" name="password" required autocomplete="current-password"></label>
        <label class="totp" hidden>Code de sécurité (application d'authentification)<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></label>
        <button class="btn btn-ink btn-lg btn-block" type="submit">${ICON.lock}Se connecter</button>
        <p class="center small">Pas encore client ? <a href="#/inscription?next=${encodeURIComponent(next)}"><b>Ouvrir mon compte or</b></a></p>
        ${demo ? '<div class="demo-fill"><span class="tiny">Démonstration :</span><button type="button" class="btn btn-light btn-sm" data-demo="client">Compte client</button><button type="button" class="btn btn-light btn-sm" data-demo="admin">Compte admin</button></div>' : ''}
      </form>
    </div></div></div>`;
  const f = $('#login', view);
  view.addEventListener('click', (e) => {
    const d = e.target.closest('[data-demo]');
    if (!d) return;
    f.email.value = d.dataset.demo === 'admin' ? 'admin@maurice-or.fr' : 'client@maurice-or.fr';
    f.password.value = d.dataset.demo === 'admin' ? 'Admin-demo-2026' : 'Client-demo-2026';
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy($('button[type=submit]', f), async () => {
      try {
        const out = await post('/api/auth/login', { ...formData(f), visitor: visitorId() });
        if (out.need2fa) { $('.totp', f).hidden = false; f.code.focus(); toast('Entrez le code de votre application d\'authentification.', 'info'); return; }
        await loadMe();
        toast(`Bonjour ${S.me.firstName} !`);
        go('#' + (S.me.role === 'admin' && next === '/espace' ? '/admin' : next));
      } catch (err) { toast(err.message, 'err'); }
    });
  });
}

export async function registerPage(view, _p, query) {
  const next = query.next || '/espace';
  if (S.me) { go('#' + next); return; }
  view.innerHTML = `<div class="auth-wrap">${authSide('Votre or,<br>comme à la banque.')}
    <div class="auth-main"><div class="auth-box">
      <h1 class="h1">Ouvrir mon compte</h1><p class="muted">Gratuit, sans engagement, en 2 minutes.</p>
      <form class="form grid2" id="reg" style="margin-top:22px">
        <label>Prénom<input name="firstName" required autocomplete="given-name"></label>
        <label>Nom<input name="lastName" required autocomplete="family-name"></label>
        <label class="span2">Adresse e-mail<input type="email" name="email" required autocomplete="email"></label>
        <label>Téléphone (WhatsApp)<input type="tel" name="phone" required autocomplete="tel"></label>
        <label>Date de naissance<input type="date" name="birthdate" required autocomplete="bday"></label>
        <label class="span2">Adresse<input name="address" required autocomplete="street-address"></label>
        <label>Code postal<input name="zip" required autocomplete="postal-code"></label>
        <label>Ville<input name="city" required autocomplete="address-level2"></label>
        <label class="span2">Mot de passe<input type="password" name="password" required minlength="10" autocomplete="new-password"><span class="pw-meter"><i></i></span><span class="tiny" id="pw-hint">Au moins 10 caractères, avec des lettres et des chiffres.</span></label>
        <label class="span2">Confirmez le mot de passe<input type="password" name="password2" required minlength="10" autocomplete="new-password"></label>
        <label class="span2 check"><input type="checkbox" name="accept" required><span>J'accepte les <a href="#/info/cgv" target="_blank">conditions générales</a> et la <a href="#/info/confidentialite" target="_blank">politique de confidentialité</a>. Je certifie être majeur.</span></label>
        <button class="btn btn-gold btn-lg span2" type="submit">Créer mon compte</button>
        <p class="span2 center small">Déjà client ? <a href="#/connexion?next=${encodeURIComponent(next)}"><b>Se connecter</b></a></p>
      </form>
    </div></div></div>`;
  const f = $('#reg', view);
  f.addEventListener('input', () => {
    const pw = f.password.value;
    const score = (pw.length >= 10) + /[A-Za-z]/.test(pw) + /\d/.test(pw) + /[^A-Za-z0-9]/.test(pw) + (pw.length >= 14);
    const bar = $('.pw-meter i', f);
    bar.style.width = `${score * 20}%`;
    bar.style.background = score >= 4 ? 'var(--green)' : score >= 3 ? 'var(--gold)' : 'var(--red)';
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.reportValidity()) return;
    const d = formData(f);
    if (d.password !== d.password2) return toast('Les deux mots de passe ne correspondent pas.', 'err');
    await busy($('button[type=submit]', f), async () => {
      try {
        await post('/api/auth/register', { ...d, visitor: visitorId() });
        await loadMe();
        toast('Bienvenue ! Votre compte est ouvert.');
        go('#' + next);
      } catch (err) { toast(err.message, 'err'); }
    });
  });
}

// ================= ESPACE =================
const NAV = [
  ['', 'Vue d\'ensemble', 'home'], ['acheter', 'Acheter', 'buy'], ['vendre', 'Vendre', 'sell'], ['coffre', 'Mon coffre', 'safe'],
  ['operations', 'Opérations', 'activity'], ['commandes', 'Commandes', 'bag'], ['securite', 'Sécurité', 'shield'], ['profil', 'Mon profil', 'user'],
];

const opIcon = (type) => ({
  versement: ['in', 'in'], vente_or: ['in', 'sell'], vente_produit: ['in', 'sell'], remboursement: ['in', 'in'], retrait_annule: ['in', 'in'],
  achat_or: ['gold', 'coins'], achat_produit: ['gold', 'bar'], commande: ['gold', 'bag'], coffre_entree: ['gold', 'safe'],
  retrait: ['', 'out'], sortie_coffre: ['', 'truck'], ouverture: ['', 'user'],
}[type] || ['', 'doc']);

function opsList(ledger, limit = 100) {
  if (!ledger.length) return `<div class="empty">${ICON.activity}Aucune opération pour le moment.</div>`;
  return `<ul class="ops">${ledger.slice(0, limit).map((l) => {
    const [cls, ico] = opIcon(l.type);
    return `<li class="op"><span class="op-ico ${cls}">${ICON[ico]}</span><span class="op-label">${esc(l.label)}<small>${date(l.at)}</small></span>
      <span class="op-amt ${l.amount > 0 ? 'pos' : ''}">${l.amount ? (l.amount > 0 ? '+' : '−') + eur(Math.abs(l.amount)) : ''}${l.goldMg ? `<small>${l.goldMg > 0 ? '+' : '−'}${mg2g(Math.abs(l.goldMg))}</small>` : ''}</span></li>`;
  }).join('')}</ul>`;
}

function pendingList(reqs, orders) {
  const r = reqs.filter((x) => x.status === 'en_attente');
  const o = orders.filter((x) => x.status === 'a_valider');
  if (!r.length && !o.length) return '';
  return `<div class="panel"><div class="panel-head"><h2>En attente de validation</h2><span class="chip chip-wait chip-dot">${r.length + o.length}</span></div>
    <p class="tiny" style="margin-top:-6px">Un conseiller vérifie vos demandes. Le prix est bloqué et le montant mis de côté jusqu'à la validation.</p>
    ${r.map((x) => `<div class="pending"><div><b>${esc(REQUEST_KIND[x.kind])} · ${eur(x.amount)}</b><small>${esc(x.label)} · ${esc(x.ref)}</small></div>
      <div style="text-align:right"><span class="timer" data-until="${x.expiresAt}">${countdown(x.expiresAt)}</span><br><button class="link small" data-cancel-req="${esc(x.ref)}">Annuler</button></div></div>`).join('')}
    ${o.map((x) => `<div class="pending"><div><b>Commande · ${eur(x.total)}</b><small>${x.items.map((i) => `${i.qty} × ${esc(i.name)}`).join(', ')}</small></div>
      <div style="text-align:right"><span class="timer" data-until="${x.expiresAt}">${countdown(x.expiresAt)}</span><br><a class="link small" href="#/commande/${esc(x.ref)}">Voir</a></div></div>`).join('')}
  </div>`;
}

export async function espacePage(view, { tab = '' }, query) {
  if (!S.me) { go('#/connexion?next=' + encodeURIComponent('/espace' + (tab ? '/' + tab : ''))); return; }
  if (!NAV.some((n) => n[0] === tab)) tab = '';
  let acc = await get('/api/account');
  let openNotifs = false;
  if (query.paiement === 'ok') toast('Paiement reçu : votre solde est mis à jour dès confirmation de la banque.');

  const shell = (content) => {
    const u = acc.user;
    const unread = acc.notifs.filter((n) => !n.read).length;
    const pend = acc.requests.filter((r) => r.status === 'en_attente').length + acc.orders.filter((o) => o.status === 'a_valider').length;
    return `<div class="app">
      <aside class="app-side">
        <div class="who"><span class="avatar">${esc(u.firstName[0] + u.lastName[0])}</span><div><b>${esc(u.firstName)} ${esc(u.lastName)}</b><span>Client n° ${esc(u.clientNo)}</span></div></div>
        ${NAV.map(([k, l, ico]) => `<a href="#/espace${k ? '/' + k : ''}" class="${k === tab ? 'is-active' : ''}">${ICON[ico]}${l}${k === '' && pend ? `<span class="count">${pend}</span>` : ''}</a>`).join('')}
        ${u.role === 'admin' ? `<div class="side-sep"></div><a href="#/admin">${ICON.settings}Administration</a>` : ''}
        <div class="side-sep"></div>
        <button class="side-link" data-act="logout">${ICON.logout}Se déconnecter</button>
        <div class="side-wa"><b>Votre conseiller</b><p>Une question, une hésitation ? Écrivez-nous.</p><a class="btn btn-wa btn-sm btn-block" href="${shopWa('')}" target="_blank" rel="noopener">${ICON.whatsapp}WhatsApp</a></div>
      </aside>
      <div class="app-main">
        <div class="app-top">
          <div><h1>${tab === '' ? `Bonjour ${esc(u.firstName)}` : NAV.find((n) => n[0] === tab)[1]}</h1><p>${tab === '' ? 'Voici l\'état de votre patrimoine en or, au cours du jour.' : `Client n° ${esc(u.clientNo)}`}</p></div>
          <div class="app-top-right">
            <a class="btn btn-wa btn-sm" href="${shopWa('')}" target="_blank" rel="noopener">${ICON.whatsapp}<span>Conseiller</span></a>
            <button class="icon-btn" data-act="notifs" aria-label="Notifications">${ICON.bell}${unread ? `<span class="badge-count">${unread}</span>` : ''}</button>
            ${openNotifs ? `<div class="notif-panel"><h3>Notifications</h3>${acc.notifs.length ? acc.notifs.map((n) => `<a class="notif ${n.read ? '' : 'unread'}" href="${esc(n.link || '#/espace')}">${esc(n.text)}<small>${ago(n.at)}</small></a>`).join('') : '<p class="empty">Aucune notification.</p>'}</div>` : ''}
          </div>
        </div>
        ${S.prices?.stale ? `<div class="notice">${ICON.alert}<span>Le cours n'a pas pu être actualisé récemment : achats et ventes reprennent dès la prochaine mise à jour.</span></div>` : ''}
        ${content}
      </div>
    </div>`;
  };

  const render = () => {
    const body = { '': overview, acheter: buyTab, vendre: sellTab, coffre: vaultTab, operations: opsTab, commandes: ordersTab, securite: securityTab, profil: profileTab }[tab]();
    view.innerHTML = shell(body);
    paintIcons(view);
    live(view);
    if (tab === 'acheter' || tab === 'vendre') quote();
  };

  // ---------- Vue d'ensemble ----------
  const overview = () => {
    const vaultCount = acc.vault.reduce((a, x) => a + x.qty, 0);
    return `${!acc.user.totpEnabled ? `<div class="notice notice-info">${ICON.shield}<span>Protégez votre or : activez le <a href="#/espace/securite"><b>code de sécurité sur votre téléphone</b></a>.</span></div>` : ''}
      <div class="bank-card">${waves(400)}
        <div class="label"><span>Valeur totale de mon compte</span><span>${ICON.lock.replace('<svg', '<svg width="16" height="16"')}</span></div>
        <div class="total">${eur(acc.total)}</div>
        <div class="bank-split">
          <div class="gold"><span>Or au gramme</span><b>${mg2g(acc.goldMg + acc.heldMg)}</b><small>${eur(acc.goldValue)}</small></div>
          <div class="gold"><span>Au coffre</span><b>${vaultCount} produit${vaultCount > 1 ? 's' : ''}</b><small>${eur(acc.vaultValue)}</small></div>
          <div><span>Solde disponible</span><b>${eur(acc.cash)}</b><small>en euros</small></div>
          <div><span>Réservé (validation)</span><b>${eur(acc.held)}</b><small>${acc.heldMg ? mg2g(acc.heldMg) + ' en vente' : 'en attente'}</small></div>
        </div>
      </div>
      <div class="quick">
        <a href="#/espace/acheter"><span class="qi qi-gold">${ICON.buy}</span>Acheter</a>
        <a href="#/espace/vendre"><span class="qi">${ICON.sell}</span>Vendre</a>
        <button data-act="deposit"><span class="qi">${ICON.in}</span>Alimenter</button>
        <button data-act="withdraw"><span class="qi">${ICON.out}</span>Retirer</button>
        <a href="#/espace/coffre"><span class="qi">${ICON.truck}</span>Me faire livrer</a>
        <a href="${shopWa('')}" target="_blank" rel="noopener"><span class="qi qi-wa">${ICON.whatsapp}</span>Conseiller</a>
      </div>
      <div class="dash-grid">
        <div>
          ${pendingList(acc.requests, acc.orders)}
          <div class="panel"><div class="panel-head"><h2>Dernières opérations</h2><a href="#/espace/operations">Tout voir</a></div>${opsList(acc.ledger, 6)}</div>
        </div>
        <div>
          <div class="panel"><div class="panel-head"><h2>Cours de l'or</h2><span class="chip chip-ok chip-dot">En direct</span></div>
            <p class="big" style="margin:0" data-live="g-eur">…</p><p class="tiny" style="margin:0 0 12px">le gramme · <span data-live="change"></span> sur 24 h</p>
            <dl class="kv"><dt>Vous achetez</dt><dd data-live="gram-buy">…</dd><dt>Vous vendez</dt><dd data-live="gram-sell">…</dd><dt>Votre or vaut</dt><dd>${eur(acc.totalGoldValue)}</dd></dl>
            <a class="btn btn-ink btn-block" href="#/espace/acheter">${ICON.buy}Acheter de l'or</a>
          </div>
          <div class="panel"><div class="panel-head"><h2>Mon conseiller</h2></div>
            <p class="small">Pour un conseil, une vente importante ou un rendez-vous en boutique, votre conseiller vous répond directement.</p>
            <a class="btn btn-wa btn-block" href="${shopWa('')}" target="_blank" rel="noopener">${ICON.whatsapp}Écrire sur WhatsApp</a>
          </div>
        </div>
      </div>`;
  };

  // ---------- Acheter ----------
  let buyMode = query.produit ? 'produit' : 'gramme';
  let buyUnit = 'eur';
  let buyProduct = query.produit || 'lingot-or-10g';
  let buyQty = Math.max(1, parseInt(query.qte, 10) || 1);
  let buyAmount = query.e || (query.acheter ? '' : '200');
  if (query.acheter) { buyUnit = 'g'; buyAmount = query.acheter; }

  const buyTab = () => {
    const c = cfg();
    const items = S.products.filter((p) => p.stock > 0 && p.price);
    return `<div class="seg inner-tabs"><button data-buymode="gramme" aria-pressed="${buyMode === 'gramme'}">Or au gramme</button><button data-buymode="produit" aria-pressed="${buyMode === 'produit'}">Lingot ou pièce</button></div>
      <div class="trade">
        <div class="panel">
          ${buyMode === 'gramme' ? `
            <div class="panel-head"><h2>Combien voulez-vous investir ?</h2><div class="seg"><button data-unit="eur" aria-pressed="${buyUnit === 'eur'}">En €</button><button data-unit="g" aria-pressed="${buyUnit === 'g'}">En grammes</button></div></div>
            <div class="amount-field"><input type="number" id="amt" min="0" step="${buyUnit === 'eur' ? 10 : 0.1}" value="${esc(buyAmount)}" inputmode="decimal" aria-label="Montant"><span>${buyUnit === 'eur' ? '€' : 'g'}</span></div>
            <div class="presets">${(buyUnit === 'eur' ? [50, 100, 250, 500, 1000] : [0.5, 1, 5, 10, 31.1]).map((v) => `<button data-preset="${v}">${String(v).replace('.', ',')} ${buyUnit === 'eur' ? '€' : 'g'}</button>`).join('')}</div>
            <p class="tiny" style="margin-top:14px">Prix du gramme : <b data-live="gram-buy">…</b> (cours + ${num2(c.gramBuySpread * 100)} %). Minimum ${String(c.minGramTrade).replace('.', ',')} g.</p>`
          : `<div class="panel-head"><h2>Choisissez votre produit</h2></div>
            <div class="pick-list">${items.map((p) => `<label class="pick"><input type="radio" name="bp" value="${p.id}"${p.id === buyProduct ? ' checked' : ''}>${productImage(p)}<span><b>${esc(p.name)}</b><small>${fmtWeight(p.weight)} · ${purity(p)}</small></span><span class="price" style="font-size:15px" data-price="${p.id}">${eur(p.price)}</span></label>`).join('')}</div>
            <div class="buy-row" style="margin-top:16px"><span class="small"><b>Quantité</b></span><div class="qty-ctl"><button class="minus" data-bq="-1" aria-label="Moins">−</button><input type="number" id="bq" min="1" max="999" value="${buyQty}" aria-label="Quantité"><button class="plus" data-bq="1" aria-label="Plus">+</button></div></div>
            <p class="tiny" style="margin-top:12px">Le produit est gardé dans votre coffre : revendable en un clic, ou livré quand vous le souhaitez.</p>`}
        </div>
        <div class="quote">
          <h3>Récapitulatif</h3>
          <dl class="kv" id="q-kv"></dl>
          ${c.approvalBuy ? `<div class="flow"><span class="on">Demande</span><span>Validation conseiller</span><span>Or crédité</span></div>
          <p class="tiny" style="color:#a9a497">Votre prix est bloqué pendant ${c.approvalWindowMin} min et le montant est mis de côté. Sans validation dans ce délai, tout vous est rendu.</p>` : ''}
          <div id="q-action"></div>
        </div>
      </div>`;
  };

  // ---------- Vendre ----------
  let sellMode = query.produit ? 'coffre' : 'gramme';
  let sellAmount = acc.goldMg ? String(Math.min(1, acc.goldMg / 1000)) : '1';
  let sellProduct = query.produit || acc.vault[0]?.product.id;
  let sellQty = 1;
  const sellTab = () => {
    const c = cfg();
    return `<div class="seg inner-tabs"><button data-sellmode="gramme" aria-pressed="${sellMode === 'gramme'}">Or au gramme</button><button data-sellmode="coffre" aria-pressed="${sellMode === 'coffre'}">Produits du coffre</button></div>
      <div class="trade">
        <div class="panel">
          ${sellMode === 'gramme' ? `
            <div class="panel-head"><h2>Combien de grammes vendre ?</h2><span class="chip chip-gold">Disponible : ${mg2g(acc.goldMg)}</span></div>
            <div class="amount-field"><input type="number" id="amt" min="0" step="0.1" value="${esc(sellAmount)}" inputmode="decimal" aria-label="Grammes à vendre"><span>g</span></div>
            <div class="presets">${[0.5, 1, 5].map((v) => `<button data-preset="${v}">${String(v).replace('.', ',')} g</button>`).join('')}<button data-preset="all">Tout vendre</button></div>
            <p class="tiny" style="margin-top:14px">Prix de rachat du gramme : <b data-live="gram-sell">…</b> (cours − ${num2(c.gramSellSpread * 100)} %). L'argent arrive sur votre solde${c.approvalSell ? ' après validation' : ' immédiatement'}.</p>`
          : acc.vault.length ? `<div class="panel-head"><h2>Quel produit revendre ?</h2></div>
            <div class="pick-list">${acc.vault.map((x) => `<label class="pick"><input type="radio" name="sp" value="${x.product.id}"${x.product.id === sellProduct ? ' checked' : ''}>${productImage(x.product)}<span><b>${esc(x.product.name)}</b><small>${x.qty} au coffre · rachat ${eur(x.product.buyback)} l'unité</small></span><span></span></label>`).join('')}</div>
            <div class="buy-row" style="margin-top:16px"><span class="small"><b>Quantité</b></span><div class="qty-ctl"><button class="minus" data-sq="-1" aria-label="Moins">−</button><input type="number" id="sq" min="1" max="999" value="${sellQty}" aria-label="Quantité"><button class="plus" data-sq="1" aria-label="Plus">+</button></div></div>`
            : `<div class="empty">${ICON.safe}Votre coffre est vide.</div>`}
        </div>
        <div class="quote"><h3>Récapitulatif</h3><dl class="kv" id="q-kv"></dl><div id="q-action"></div>
          <p class="tiny" style="color:#a9a497">Vous avez de l'or chez vous (bijoux, pièces) ? <a href="#/info/vendre" style="color:var(--gold-light)">Faites-le estimer</a>.</p></div>
      </div>`;
  };

  // Calcule le devis affiché à droite, sans rien engager.
  let current = null;
  function quote() {
    const p = S.prices;
    const kv = $('#q-kv', view), act = $('#q-action', view);
    if (!kv || !p || !p.available) return;
    current = null;
    let rows = [], btn = '';
    if (tab === 'acheter') {
      if (buyMode === 'gramme') {
        const v = Math.max(0, Number(String($('#amt', view)?.value || '0').replace(',', '.')) || 0);
        buyAmount = String(v);
        const mg = buyUnit === 'eur' ? Math.floor(v * 100 * 1000 / p.gramBuy) : Math.floor(v * 1000);
        const cost = Math.round(mg * p.gramBuy / 1000);
        rows = [['Prix du gramme', eur(p.gramBuy)], ['Quantité d\'or', mg2g(mg)], ['Solde disponible', eur(acc.cash)], ['Total', eur(cost)]];
        current = { kind: 'buy_gold', mg, cost, unit: p.gramBuy, what: `achat de ${mg2g(mg)} d'or`, ok: mg >= cfg().minGramTrade * 1000 };
      } else {
        const prod = S.byId[$('input[name=bp]:checked', view)?.value || buyProduct];
        if (!prod) return;
        buyProduct = prod.id;
        const n = Math.max(1, parseInt($('#bq', view)?.value, 10) || 1);
        buyQty = n;
        let u = prod.tiers[0].unit; for (const t of prod.tiers) if (n >= t.min) u = t.unit;
        rows = [['Produit', esc(prod.name)], ['Prix unitaire', eur(u)], ['Quantité', n], ['Solde disponible', eur(acc.cash)], ['Total', eur(u * n)]];
        current = { kind: 'buy_product', productId: prod.id, qty: n, unit: u, cost: u * n, what: `achat de ${n} × ${prod.name}`, ok: n <= prod.stock };
      }
      const short = current.cost > acc.cash;
      btn = short
        ? `<div class="notice" style="margin:4px 0 12px">${ICON.info}<span>Il manque ${eur(current.cost - acc.cash)} sur votre solde.</span></div><button class="btn btn-gold btn-block btn-lg" data-act="deposit">${ICON.in}Alimenter mon compte</button>`
        : `<button class="btn btn-gold btn-block btn-lg" data-act="confirm"${current.ok && current.cost > 0 ? '' : ' disabled'}>${cfg().approvalBuy ? 'Envoyer ma demande d\'achat' : 'Acheter maintenant'}</button>`;
    } else {
      if (sellMode === 'gramme') {
        const raw = $('#amt', view)?.value || '0';
        const v = Math.max(0, Number(String(raw).replace(',', '.')) || 0);
        sellAmount = String(v);
        const mg = Math.min(Math.floor(v * 1000), acc.goldMg);
        const proceeds = Math.floor(mg * p.gramSell / 1000);
        rows = [['Prix de rachat du gramme', eur(p.gramSell)], ['Quantité vendue', mg2g(mg)], ['Il vous restera', mg2g(acc.goldMg - mg)], ['Vous recevez', eur(proceeds)]];
        current = { kind: 'sell_gold', mg, all: mg === acc.goldMg, cost: proceeds, unit: p.gramSell, what: `vente de ${mg2g(mg)} d'or`, ok: mg > 0 && v * 1000 <= acc.goldMg + 0.5 };
      } else {
        const item = acc.vault.find((x) => x.product.id === ($('input[name=sp]:checked', view)?.value || sellProduct));
        if (!item) { kv.innerHTML = ''; act.innerHTML = ''; return; }
        sellProduct = item.product.id;
        const n = Math.max(1, Math.min(item.qty, parseInt($('#sq', view)?.value, 10) || 1));
        sellQty = n;
        const u = S.byId[item.product.id]?.buyback || item.product.buyback;
        rows = [['Produit', esc(item.product.name)], ['Prix de rachat unitaire', eur(u)], ['Quantité', `${n} / ${item.qty}`], ['Vous recevez', eur(u * n)]];
        current = { kind: 'sell_product', productId: item.product.id, qty: n, unit: u, cost: u * n, what: `revente de ${n} × ${item.product.name}`, ok: true };
      }
      btn = `<button class="btn btn-gold btn-block btn-lg" data-act="confirm"${current.ok ? '' : ' disabled'}>${cfg().approvalSell ? 'Envoyer ma demande de vente' : 'Vendre maintenant'}</button>`;
    }
    kv.innerHTML = rows.map(([k, v], i) => `<dt${i === rows.length - 1 ? ' class="tot"' : ''}>${k}</dt><dd${i === rows.length - 1 ? ' class="tot"' : ''}>${v}</dd>`).join('');
    act.innerHTML = btn;
    paintIcons(act);
  }

  // Deuxième étape : fenêtre de confirmation avec le montant exact.
  function confirmTrade() {
    if (!current) return;
    const c = cfg();
    const buying = current.kind.startsWith('buy');
    const approval = buying ? c.approvalBuy : c.approvalSell;
    const op = { ...current };
    track('trade_open', { what: op.what, amount: op.cost });
    let done = false;
    const m = modal(`<h2>${buying ? 'Confirmer l\'achat' : 'Confirmer la vente'}</h2>
      <div class="confirm-amt"><span>${buying ? 'Montant débité' : 'Montant crédité'}</span><b>${eur(op.cost)}</b><span>${esc(op.what)}</span></div>
      ${approval ? `<div class="flow"><span class="done">Votre demande</span><span class="on">Validation conseiller</span><span>${buying ? 'Or crédité' : 'Argent crédité'}</span></div>
        <p class="small">Le prix est bloqué pendant ${c.approvalWindowMin} minutes et le montant est mis de côté. Vous êtes prévenu dès que votre conseiller a validé.</p>`
        : '<p class="small">L\'opération est exécutée immédiatement au prix affiché.</p>'}
      <p class="tiny">Si le cours bouge de plus de ${num2((c.maxPriceMove ?? 0.005) * 100)} % d'ici votre clic, on vous montre le nouveau prix.</p>
      <div class="modal-btns"><button class="btn btn-light" data-x>Annuler</button><button class="btn btn-gold" data-ok>${approval ? 'Envoyer la demande' : 'Confirmer'}</button></div>`,
    { onClose: () => { if (!done) track('trade_cancel', { what: op.what }); } });
    m.el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-x]')) { m.close(); return; }
      const ok = e.target.closest('[data-ok]');
      if (!ok) return;
      await busy(ok, async () => {
        try {
          const url = { buy_gold: '/api/wallet/buy-gold', sell_gold: '/api/wallet/sell-gold', buy_product: '/api/wallet/buy-product', sell_product: '/api/wallet/sell-product' }[op.kind];
          const body = op.kind.endsWith('gold') ? { grams: op.mg / 1000, all: op.all, expected: op.unit } : { productId: op.productId, qty: op.qty, expected: op.unit };
          const r = await post(url, body);
          done = true;
          m.close(true);
          if (r.pending) {
            modal(`<div class="center"><div class="empty" style="padding:10px">${ICON.clock}</div><h2>Demande envoyée</h2>
              <p>Votre conseiller va la valider. Prix bloqué jusqu'à <b>${time(r.request.expiresAt)}</b>.</p><p class="small muted">Référence ${esc(r.request.ref)}. Vous recevrez une notification.</p>
              <a class="btn btn-wa btn-block" href="${shopWa(`je viens d'envoyer la demande ${r.request.ref} (${op.what}).`)}" target="_blank" rel="noopener">${ICON.whatsapp}Prévenir mon conseiller</a></div>`);
          } else toast(buying ? 'Achat confirmé.' : `Vente confirmée : ${eur(r.amount)} crédités.`);
          await loadProducts().catch(() => {});
          await refresh();
          if (r.pending) { tab = ''; history.replaceState(null, '', '#/espace'); render(); }
        } catch (err) {
          toast(err.message, 'err');
          if (err.status === 409) { await loadPrices(); await loadProducts().catch(() => {}); m.close(true); quote(); }
        }
      });
    });
  }

  // ---------- Coffre ----------
  const vaultTab = () => {
    if (!acc.vault.length) return `<div class="panel"><div class="empty">${ICON.safe}<p>Votre coffre est vide.</p><a class="btn btn-ink" href="#/espace/acheter?produit=lingot-or-10g">Acheter un lingot</a></div></div>`;
    return `<p class="muted" style="margin-top:-10px">Vos lingots et pièces sont stockés en sécurité. Valeur du métal : <b>${eur(acc.vaultValue)}</b>.</p>
      <div class="vault-grid">${acc.vault.map((x) => `<div class="vault-item">${productImage(x.product)}
        <b>${esc(x.product.name)}</b>
        <div class="row"><span class="muted">Quantité</span><b>${x.qty}</b></div>
        <div class="row"><span class="muted">Valeur métal</span><b>${eur(x.value)}</b></div>
        <div class="row"><span class="muted">Revente immédiate</span><b>${eur(x.buyback)}</b></div>
        <div class="btns"><a class="btn btn-light btn-sm" href="#/espace/vendre?produit=${x.product.id}">${ICON.sell}Revendre</a><button class="btn btn-ink btn-sm" data-deliver="${x.product.id}">${ICON.truck}Recevoir</button></div></div>`).join('')}</div>`;
  };

  // ---------- Opérations ----------
  let opsView = 'mouvements';
  const DEP = { en_attente: ['chip-wait', 'En attente'], validee: ['chip-ok', 'Crédité'], refusee: ['chip-err', 'Refusé'] };
  const WD = { en_attente: ['chip-wait', 'En cours'], effectue: ['chip-ok', 'Envoyé'], refuse: ['chip-err', 'Refusé'] };
  const REQ = { en_attente: 'chip-wait', validee: 'chip-ok', refusee: 'chip-err', expiree: 'chip-err', annulee: '' };
  const opsTab = () => `<div class="seg inner-tabs">${[['mouvements', 'Mouvements'], ['demandes', 'Demandes'], ['versements', 'Versements'], ['retraits', 'Retraits']].map(([k, l]) => `<button data-ops="${k}" aria-pressed="${k === opsView}">${l}</button>`).join('')}</div>
    <div class="panel">${{
    mouvements: () => opsList(acc.ledger),
    demandes: () => (acc.requests.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Opération</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
        ${acc.requests.map((r) => `<tr><td>${date(r.createdAt)}<br><small>${esc(r.ref)}</small></td><td>${esc(REQUEST_KIND[r.kind])}<br><small>${esc(r.label)}</small></td><td><b>${eur(r.amount)}</b></td><td><span class="chip ${REQ[r.status]}">${REQUEST_STATUS[r.status]}</span>${r.note ? `<br><small>${esc(r.note)}</small>` : ''}${r.status === 'en_attente' ? `<br><button class="link small" data-cancel-req="${esc(r.ref)}">Annuler</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${ICON.doc}Aucune demande.</div>`),
    versements: () => (acc.deposits.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Référence</th><th>Mode</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
        ${acc.deposits.map((d) => `<tr><td>${date(d.createdAt)}</td><td>${esc(d.ref)}</td><td>${d.method === 'carte' ? 'Carte' : 'Virement'}</td><td><b>${eur(d.amount)}</b></td><td><span class="chip ${DEP[d.status][0]}">${DEP[d.status][1]}</span></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${ICON.in}Aucun versement.</div>`),
    retraits: () => (acc.withdrawals.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Référence</th><th>Vers</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
        ${acc.withdrawals.map((w) => `<tr><td>${date(w.createdAt)}</td><td>${esc(w.ref)}</td><td class="mono">${esc(w.iban.slice(0, 4))}…${esc(w.iban.slice(-4))}</td><td><b>${eur(w.amount)}</b></td><td><span class="chip ${WD[w.status][0]}">${WD[w.status][1]}</span></td></tr>`).join('')}</tbody></table></div>` : `<div class="empty">${ICON.out}Aucun retrait.</div>`),
  }[opsView]()}</div>`;

  const ordersTab = () => (acc.orders.length ? `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Commande</th><th>Date</th><th>Articles</th><th>Total</th><th>Statut</th></tr></thead><tbody>
    ${acc.orders.map((o) => `<tr><td><a href="#/commande/${esc(o.ref)}">${esc(o.ref)}</a></td><td>${date(o.createdAt)}</td><td>${o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join('<br>')}</td><td><b>${eur(o.total)}</b></td>
      <td><span class="chip ${['annulee', 'refusee', 'expiree'].includes(o.status) ? 'chip-err' : ['a_valider', 'en_attente_paiement'].includes(o.status) ? 'chip-wait' : 'chip-ok'}">${esc(ORDER_STATUS[o.status])}</span></td></tr>`).join('')}</tbody></table></div></div>`
    : `<div class="panel"><div class="empty">${ICON.bag}<p>Aucune commande.</p><a class="btn btn-ink" href="#/boutique">Voir la boutique</a></div></div>`);

  const securityTab = () => `<div class="two-cols">
    <div class="panel"><h2 class="h3">Code de sécurité sur téléphone</h2>
      ${acc.user.totpEnabled
        ? `<div class="notice notice-ok">${ICON.check}<span>Activé. Un code vous est demandé à chaque connexion et pour chaque retrait.</span></div>
          <form class="form" id="totp-off"><label>Mot de passe<input type="password" name="password" required></label><label>Code actuel<input name="code" inputmode="numeric" maxlength="6" required></label><button class="btn btn-red" type="submit">Désactiver</button></form>`
        : `<p class="small">En plus du mot de passe, un code à 6 chiffres affiché sur votre téléphone (Google Authenticator, Microsoft Authenticator…). Même si quelqu'un vole votre mot de passe, il ne peut pas entrer.</p>
          <button class="btn btn-ink" data-act="totp-setup">${ICON.shield}Activer</button><div id="totp-zone"></div>`}
    </div>
    <form class="panel form" id="pwform"><h2 class="h3">Mot de passe</h2>
      <label>Mot de passe actuel<input type="password" name="current" required autocomplete="current-password"></label>
      <label>Nouveau mot de passe<input type="password" name="next" required minlength="10" autocomplete="new-password"></label>
      <button class="btn btn-ink" type="submit">Changer le mot de passe</button>
      <p class="tiny">Vos autres appareils seront déconnectés.</p></form>
  </div>
  <div class="panel"><h2 class="h3">Ce qui protège votre compte</h2><ul class="list small">
    <li>Mot de passe chiffré : personne, même nous, ne peut le lire.</li><li>Compte verrouillé 15 minutes après 5 erreurs.</li>
    <li>Session fermée après 4 h d'inactivité.</li><li>Chaque achat vérifié par un conseiller avant exécution.</li>
    <li>Retraits uniquement vers un compte bancaire, confirmés par mot de passe.</li><li>Nous ne vous demanderons jamais votre mot de passe, ni par e-mail, ni par téléphone, ni sur WhatsApp.</li></ul></div>`;

  const profileTab = () => {
    const u = acc.user;
    return `<form class="panel form grid2" id="profile">
      <label>Prénom<input value="${esc(u.firstName)}" disabled></label><label>Nom<input value="${esc(u.lastName)}" disabled></label>
      <label class="span2">E-mail<input value="${esc(u.email)}" disabled></label>
      <label>Téléphone (WhatsApp)<input name="phone" value="${esc(u.phone)}" required></label><label>Pays<input name="country" value="${esc(u.country)}"></label>
      <label class="span2">Adresse<input name="address" value="${esc(u.address)}" required></label>
      <label>Code postal<input name="zip" value="${esc(u.zip)}" required></label><label>Ville<input name="city" value="${esc(u.city)}" required></label>
      <p class="span2 tiny">Pour changer de nom ou d'e-mail, contactez votre conseiller avec une pièce d'identité.</p>
      <button class="btn btn-ink span2" type="submit">Enregistrer</button></form>`;
  };

  async function refresh() {
    acc = await get('/api/account');
    render();
  }

  // ---------- Actions ----------
  const actions = {
    async logout() { await post('/api/auth/logout'); await loadMe(); toast('Vous êtes déconnecté.'); go('#/'); },
    notifs() {
      openNotifs = !openNotifs;
      render();
      if (openNotifs && acc.notifs.some((n) => !n.read)) {
        // marquées lues pour la prochaine ouverture ; le panneau garde leur surbrillance
        post('/api/notifs/read').catch(() => {});
        acc.notifs = acc.notifs.map((n) => ({ ...n, read: true }));
      }
    },
    confirm: confirmTrade,
    deposit() {
      const card = cfg().cardEnabled;
      const m = modal(`<h2>Alimenter mon compte</h2>
        <form class="form" id="dep"><div class="amount-field"><input type="number" name="amount" min="10" step="1" required value="${current && current.cost > acc.cash ? Math.ceil((current.cost - acc.cash) / 100) : 500}" aria-label="Montant"><span>€</span></div>
        <div class="choices">
          ${card ? `<label class="choice"><input type="radio" name="method" value="carte" checked><span class="choice-ico">${ICON.card}</span><span><b>Carte bancaire</b><small>Immédiat</small></span></label>` : ''}
          <label class="choice"><input type="radio" name="method" value="virement"${card ? '' : ' checked'}><span class="choice-ico">${ICON.euro}</span><span><b>Virement</b><small>1 à 2 jours ouvrés</small></span></label></div>
        <button class="btn btn-gold btn-lg" type="submit">Continuer</button></form><div id="dep-out"></div>`);
      $('#dep', m.el).addEventListener('submit', async (e) => {
        e.preventDefault();
        await busy($('button[type=submit]', e.target), async () => {
          try {
            const r = await post('/api/wallet/deposit', formData(e.target));
            if (r.redirect) { location.href = r.redirect; return; }
            if (r.instant) { toast(`${eur(r.deposit.amount)} ajoutés à votre solde.`); m.close(); refresh(); return; }
            e.target.hidden = true;
            $('#dep-out', m.el).innerHTML = `<p>Faites un virement de <b>${eur(r.deposit.amount)}</b> vers :</p>
              <dl class="kv"><dt>Bénéficiaire</dt><dd>${esc(r.bank.holder)}</dd><dt>IBAN</dt><dd class="mono">${esc(r.bank.iban)}</dd><dt>BIC</dt><dd class="mono">${esc(r.bank.bic)}</dd><dt>Référence à indiquer</dt><dd class="mono"><b>${esc(r.bank.ref)}</b></dd></dl>
              <div class="notice notice-info">${ICON.info}<span>Votre solde est crédité dès réception. Vous recevrez une notification.</span></div>`;
            acc = await get('/api/account');
          } catch (err) { toast(err.message, 'err'); }
        });
      });
    },
    withdraw() {
      const m = modal(`<h2>Retirer vers ma banque</h2>
        <p>Disponible : <b>${eur(acc.cash)}</b></p>
        <form class="form" id="wd">
          <div class="amount-field"><input type="number" name="amount" min="10" step="0.01" max="${acc.cash / 100}" required aria-label="Montant"><span>€</span></div>
          <label>Titulaire du compte<input name="holder" required value="${esc(acc.user.firstName + ' ' + acc.user.lastName)}"></label>
          <label>IBAN<input name="iban" required placeholder="FR76 …" autocomplete="off"></label>
          <label>Mot de passe (confirmation)<input type="password" name="password" required autocomplete="current-password"></label>
          ${acc.user.totpEnabled ? '<label>Code de sécurité<input name="code" inputmode="numeric" maxlength="6" required></label>' : ''}
          <button class="btn btn-ink btn-lg" type="submit">${lockIco}Demander le virement</button>
          <p class="tiny">Envoyé sous 1 à 2 jours ouvrés, uniquement vers un compte à votre nom.</p></form>`);
      $('#wd', m.el).addEventListener('submit', async (e) => {
        e.preventDefault();
        await busy($('button[type=submit]', e.target), async () => {
          try { const r = await post('/api/wallet/withdraw', formData(e.target)); toast(`Retrait ${r.withdrawal.ref} enregistré.`); m.close(); refresh(); }
          catch (err) { toast(err.message, 'err'); }
        });
      });
    },
    async 'totp-setup'(btn) {
      await busy(btn, async () => {
        try {
          const r = await post('/api/auth/2fa/setup');
          $('#totp-zone', view).innerHTML = `<p class="small" style="margin-top:14px">1. Scannez ce code avec votre application (ou <a href="${esc(r.uri)}">touchez ici sur téléphone</a>) :</p>
            <div id="qr" class="qr"></div><p class="tiny">Clé manuelle : <span class="mono">${esc(r.secret.replace(/(.{4})/g, '$1 ').trim())}</span></p>
            <form class="form" id="totp-on"><label>2. Code affiché<input name="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label><button class="btn btn-ink" type="submit">Valider</button></form>`;
          drawQr($('#qr', view), r.uri);
        } catch (err) { toast(err.message, 'err'); }
      });
    },
  };

  view.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]');
    if (a && actions[a.dataset.act]) { actions[a.dataset.act](a); return; }
    if (openNotifs && !e.target.closest('.notif-panel')) { openNotifs = false; render(); }
    const bm = e.target.closest('[data-buymode]');
    if (bm) { buyMode = bm.dataset.buymode; render(); return; }
    const un = e.target.closest('[data-unit]');
    if (un) { buyUnit = un.dataset.unit; buyAmount = buyUnit === 'eur' ? '200' : '1'; render(); return; }
    const sm = e.target.closest('[data-sellmode]');
    if (sm) { sellMode = sm.dataset.sellmode; render(); return; }
    const ov = e.target.closest('[data-ops]');
    if (ov) { opsView = ov.dataset.ops; render(); return; }
    const pr = e.target.closest('[data-preset]');
    if (pr) { $('#amt', view).value = pr.dataset.preset === 'all' ? acc.goldMg / 1000 : pr.dataset.preset; quote(); return; }
    const bq = e.target.closest('[data-bq], [data-sq]');
    if (bq) { const inp = $(bq.dataset.bq ? '#bq' : '#sq', view); inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) + Number(bq.dataset.bq || bq.dataset.sq)); quote(); return; }
    const cr = e.target.closest('[data-cancel-req]');
    if (cr && confirm('Annuler cette demande ? Le montant réservé vous est rendu.')) {
      await busy(cr, async () => { try { await post(`/api/requests/${encodeURIComponent(cr.dataset.cancelReq)}/cancel`); toast('Demande annulée.'); await loadProducts().catch(() => {}); refresh(); } catch (err) { toast(err.message, 'err'); } });
      return;
    }
    const dv = e.target.closest('[data-deliver]');
    if (dv) deliverModal(dv.dataset.deliver);
  });
  view.addEventListener('input', (e) => { if (['amt', 'bq', 'sq'].includes(e.target.id)) quote(); });
  view.addEventListener('change', (e) => { if (['bp', 'sp'].includes(e.target.name)) quote(); });
  view.addEventListener('submit', async (e) => {
    const f = e.target;
    const urls = { pwform: '/api/auth/password', 'totp-on': '/api/auth/2fa/enable', 'totp-off': '/api/auth/2fa/disable', profile: '/api/auth/profile' };
    if (!urls[f.id]) return;
    e.preventDefault();
    await busy($('button[type=submit]', f), async () => {
      try {
        await post(urls[f.id], formData(f));
        toast({ pwform: 'Mot de passe modifié.', 'totp-on': 'Code de sécurité activé.', 'totp-off': 'Code de sécurité désactivé.', profile: 'Informations enregistrées.' }[f.id]);
        await loadMe(); refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
  });

  function deliverModal(firstId) {
    const u = acc.user, c = cfg();
    const m = modal(`<h2>Recevoir mon or</h2>
      <form class="form" id="dl">
        ${acc.vault.map((x) => `<div class="buy-row" style="justify-content:space-between"><span class="small"><b>${esc(x.product.name)}</b> <span class="muted">(${x.qty} au coffre)</span></span>
          <input class="in-sm" type="number" name="q-${x.product.id}" min="0" max="${x.qty}" value="${x.product.id === firstId ? x.qty : 0}" aria-label="Quantité"></div>`).join('')}
        <div class="choices">
          <label class="choice"><input type="radio" name="delivery" value="domicile" checked><span class="choice-ico">${ICON.truck}</span><span><b>Livraison assurée</b><small>${eur(c.shippingFee)}, offerte dès ${eur(c.freeShippingFrom)}</small></span></label>
          <label class="choice"><input type="radio" name="delivery" value="boutique"><span class="choice-ico">${ICON.shop}</span><span><b>Retrait en boutique</b><small>Gratuit</small></span></label></div>
        <div class="grid2" id="dl-addr">
          <label>Nom complet<input name="name" value="${esc(u.firstName + ' ' + u.lastName)}"></label><label>Téléphone<input name="phone" value="${esc(u.phone)}"></label>
          <label class="span2">Adresse<input name="address" value="${esc(u.address)}"></label><label>Code postal<input name="zip" value="${esc(u.zip)}"></label><label>Ville<input name="city" value="${esc(u.city)}"></label></div>
        <button class="btn btn-gold btn-lg" type="submit">Confirmer</button></form>`, { wide: true });
    const f = $('#dl', m.el);
    f.addEventListener('change', () => { $('#dl-addr', m.el).hidden = f.delivery.value !== 'domicile'; });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = formData(f);
      const items = acc.vault.map((x) => ({ id: x.product.id, qty: Number(d['q-' + x.product.id]) || 0 })).filter((x) => x.qty > 0);
      await busy($('button[type=submit]', f), async () => {
        try {
          const r = await post('/api/wallet/deliver', { items, delivery: d.delivery, address: { name: d.name, phone: d.phone, address: d.address, zip: d.zip, city: d.city } });
          toast(`Demande ${r.order.ref} enregistrée.`); m.close(); refresh();
        } catch (err) { toast(err.message, 'err'); }
      });
    });
  }

  render();

  // Comptes à rebours, et vérification régulière des validations.
  const tick = setInterval(() => { $$('[data-until]', view).forEach((el) => { el.textContent = countdown(el.dataset.until); }); }, 1000);
  const poll = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const next = await get('/api/account');
      const fresh = next.notifs.filter((n) => !n.read && !acc.notifs.some((o) => o.id === n.id));
      const busyNow = $('.modal-back') || (document.activeElement && view.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
      fresh.forEach((n) => toast(n.text, 'info'));
      acc = next;
      if (fresh.length && !busyNow) render();
    } catch { /* réseau */ }
  }, 15000);
  return () => { clearInterval(tick); clearInterval(poll); };
}

// QR code de la double authentification (bibliothèque chargée à la demande).
function drawQr(el, text) {
  const draw = () => { el.innerHTML = ''; new window.QRCode(el, { text, width: 180, height: 180, correctLevel: window.QRCode.CorrectLevel.M }); };
  if (window.QRCode) return draw();
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  s.onload = draw;
  s.onerror = () => { el.innerHTML = '<p class="tiny">QR code indisponible : utilisez la clé manuelle ci-dessous.</p>'; };
  document.head.appendChild(s);
}
