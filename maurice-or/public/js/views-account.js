// Espace client : connexion, inscription, portefeuille or (acheter / vendre au gramme,
// coffre, versements, retraits), historique, commandes, sécurité.
import { S, on, loadMe, loadPrices, loadProducts } from './store.js';
import { post, get, demo } from './api.js';
import { $, $$, esc, eur, num2, gramsNum, toast, modal, busy, formData, date, ago, time, countdown, ICON, ask } from './ui.js';
import { productImage, go, live, shopWa } from './app.js';
import { ORDER_STATUS, REQUEST_STATUS, REQUEST_KIND } from './shared/core.js';
import { track, visitorId } from './track.js';
import { DEFAULT_SETTINGS } from './shared/pricing.js';

const mg2g = (mg) => gramsNum(mg / 1000) + ' g';

// ================= CONNEXION =================
export async function loginPage(view, _p, query) {
  const next = query.next || '/compte';
  if (S.me) { go('#' + next); return; }
  view.innerHTML = `<div class="page page-narrow">
    <h1 class="title">Connexion</h1>
    <form class="form card" id="login" novalidate>
      <label>Adresse e-mail<input type="email" name="email" required autocomplete="username"></label>
      <label>Mot de passe<input type="password" name="password" required autocomplete="current-password"></label>
      <label class="totp" hidden>Code de double authentification<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="\\d{6}"></label>
      <button class="btn-buy" type="submit">Se connecter</button>
      <p class="center">Pas encore de compte ? <a href="#/inscription?next=${encodeURIComponent(next)}">Créez votre compte poids or</a></p>
      ${demo ? `<div class="demo-fill"><p class="tiny">Démo :</p><button type="button" class="btn-outline" data-demo="client">Remplir compte client</button><button type="button" class="btn-outline" data-demo="admin">Remplir compte admin</button></div>` : ''}
    </form>
  </div>`;
  const f = $('#login', view);
  view.addEventListener('click', (e) => {
    const d = e.target.closest('[data-demo]');
    if (!d) return;
    f.email.value = d.dataset.demo === 'admin' ? 'admin@maurice-or.fr' : 'client@maurice-or.fr';
    f.password.value = d.dataset.demo === 'admin' ? 'Admin-demo-2026' : 'Client-demo-2026';
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', f);
    await busy(btn, async () => {
      try {
        const out = await post('/api/auth/login', { ...formData(f), visitor: visitorId() });
        if (out.need2fa) {
          $('.totp', f).hidden = false;
          f.code.required = true;
          f.code.focus();
          toast('Entrez le code affiché dans votre application d\'authentification.');
          return;
        }
        await loadMe();
        toast(`Bonjour ${S.me.firstName} !`);
        go('#' + next);
      } catch (err) { toast(err.message, 'err'); }
    });
  });
}

// ================= INSCRIPTION =================
export async function registerPage(view, _p, query) {
  const next = query.next || '/compte';
  if (S.me) { go('#' + next); return; }
  view.innerHTML = `<div class="page page-narrow">
    <h1 class="title">Créez votre compte poids or</h1>
    <p class="lead center">Un compte sécurisé pour acheter, stocker et revendre votre or au gramme près.</p>
    <form class="form card grid2" id="reg">
      <label>Prénom<input name="firstName" required autocomplete="given-name"></label>
      <label>Nom<input name="lastName" required autocomplete="family-name"></label>
      <label class="span2">Adresse e-mail<input type="email" name="email" required autocomplete="email"></label>
      <label>Téléphone<input type="tel" name="phone" required autocomplete="tel"></label>
      <label>Date de naissance<input type="date" name="birthdate" required autocomplete="bday"></label>
      <label class="span2">Adresse<input name="address" required autocomplete="street-address"></label>
      <label>Code postal<input name="zip" required autocomplete="postal-code"></label>
      <label>Ville<input name="city" required autocomplete="address-level2"></label>
      <label>Mot de passe<input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <label>Confirmez<input type="password" name="password2" required minlength="10" autocomplete="new-password"></label>
      <p class="span2 tiny" id="pw-hint">Au moins 10 caractères, avec des lettres et des chiffres.</p>
      <label class="span2 check"><input type="checkbox" name="accept" required> J'accepte les <a href="#/info/cgv" target="_blank">conditions générales</a> et la <a href="#/info/confidentialite" target="_blank">politique de confidentialité</a>. Je certifie être majeur.</label>
      <button class="btn-buy span2" type="submit">Créer mon compte</button>
      <p class="span2 center">Déjà client ? <a href="#/connexion?next=${encodeURIComponent(next)}">Connectez-vous</a></p>
    </form>
  </div>`;
  const f = $('#reg', view);
  f.addEventListener('input', () => {
    const pw = f.password.value;
    const ok = pw.length >= 10 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
    $('#pw-hint', view).className = 'span2 tiny ' + (pw ? (ok ? 'ok' : 'ko') : '');
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

// ================= MON COMPTE =================
const TABS = [['coffre', 'Mes pièces & lingots'], ['demandes', 'Mes demandes'], ['historique', 'Historique'], ['commandes', 'Commandes'], ['argent', 'Versements & retraits'], ['securite', 'Sécurité'], ['infos', 'Mes informations']];
const DEP_STATUS = { en_attente: 'En attente', validee: 'Validé', refusee: 'Refusé' };
const WD_STATUS = { en_attente: 'En cours', effectue: 'Effectué', refuse: 'Refusé' };

export async function accountPage(view, { tab = 'coffre' }, query) {
  if (!S.me) { go('#/connexion?next=' + encodeURIComponent(location.hash.slice(1) || '/compte')); return; }
  let acc = await get('/api/account');
  const cfg = S.config || DEFAULT_SETTINGS;
  if (query.paiement === 'ok') toast('Paiement reçu : votre solde est mis à jour dès confirmation de la banque.');
  const bars = () => S.products.filter((p) => p.category === 'lingot' && p.stock > 0).sort((a, b) => a.weight - b.weight);
  const coins = () => S.products.filter((p) => p.category === 'piece' && p.metal === 'or' && p.stock > 0);

  const paint = () => {
    const u = acc.user;
    // Le porte-monnaie : euros, or au gramme, pièces et lingots gardés au coffre
    const inVault = (cat) => acc.vault.filter((x) => x.product.category === cat);
    const vCoins = inVault('piece'), vBars = inVault('lingot');
    const nCoins = vCoins.reduce((a, x) => a + x.qty, 0), nBars = vBars.reduce((a, x) => a + x.qty, 0);
    const vCoinsVal = vCoins.reduce((a, x) => a + x.value, 0), vBarsVal = vBars.reduce((a, x) => a + x.value, 0);
    const detail = (list) => list.map((x) => `${x.qty} × ${esc(x.product.name)}`).join(' · ');
    view.innerHTML = `<div class="page page-wide account">
      <h1 class="title">Mon compte</h1>
      ${S.prices?.stale ? '<p class="stale-warning">Le cours n\'a pas pu être actualisé récemment : achats et ventes reprennent dès la prochaine mise à jour.</p>' : ''}
      <div class="acc-head">
        <span class="avatar">${ICON.user}</span>
        <div class="idcard"><b>${esc(u.lastName.toUpperCase())}</b><b>${esc(u.firstName)}</b><span>N° client : ${esc(u.clientNo)}</span></div>
        <div class="acc-actions">
          <a class="btn-wa" href="${shopWa('')}" target="_blank" rel="noopener">${ICON.whatsapp} Mon conseiller</a>
          ${u.role === 'admin' ? '<a class="btn-outline" href="#/admin">Administration</a>' : ''}
          <button class="btn-outline" data-act="logout">Se déconnecter</button>
        </div>
      </div>
      ${notifBlock()}
      ${pendingBlock()}
      ${!u.totpEnabled ? `<p class="info-box">${ICON.lock.replace('<svg', '<svg class="inline-ico"')} Protégez votre or : activez la <a href="#/compte/securite">double authentification</a>.</p>` : ''}

      <div class="wallet">
        <div class="wallet-panel">
          <h2 class="wallet-title">Mon porte-monnaie</h2>
          <div class="wrow"><span class="wlabel">Gramme</span><span class="wbox"><small>QTÉ :</small><b>${mg2g(acc.goldMg)}</b><em>${eur(acc.goldValue)}</em></span></div>
          <div class="wrow"><span class="wlabel">Pièces</span><span class="wbox"><small>QTÉ :</small><b>${nCoins}</b><em>${eur(vCoinsVal)}</em></span></div>
          ${nCoins ? `<p class="wdetail">${detail(vCoins)}</p>` : ''}
          <div class="wrow"><span class="wlabel">Lingots</span><span class="wbox"><small>QTÉ :</small><b>${nBars}</b><em>${eur(vBarsVal)}</em></span></div>
          ${nBars ? `<p class="wdetail">${detail(vBars)}</p>` : ''}
          <div class="wrow"><span class="wlabel">Total or</span><span class="wbox"><small>QTÉ :</small><b>${mg2g(acc.totalGoldMg)}</b><em>${eur(acc.totalGoldValue)}</em></span></div>
          <div class="wrow wrow-cash"><span class="wlabel">Solde</span><span class="wbox"><small>EUROS :</small><b>${eur(acc.cash)}</b><em>disponible</em></span></div>
          ${acc.held || acc.heldMg ? `<p class="held-line">Réservé en attente de validation : <b>${eur(acc.held)}</b>${acc.heldMg ? ` · ${mg2g(acc.heldMg)} en vente` : ''}</p>` : ''}
          <div class="wallet-cash-btns"><button class="btn-gold" data-act="deposit">Alimenter</button><button class="btn-gold-outline" data-act="withdraw">Retirer</button></div>
        </div>
        <div class="wallet-actions">
          <div class="wact">
            <button class="pill" data-act="buy-gram">Acheter un gramme</button>
            <label class="wq"><small>QTÉ :</small><input type="number" id="q-buy" min="${cfg.minGramTrade}" step="0.1" value="${esc(query.acheter || '1')}" aria-label="Grammes à acheter"><span>g</span><b id="p-buy">…</b></label>
          </div>
          <div class="wact">
            <button class="pill" data-act="sell-gram">Vendre un gramme</button>
            <label class="wq"><small>QTÉ :</small><input type="number" id="q-sell" min="${cfg.minGramTrade}" step="0.1" value="${acc.goldMg ? Math.min(1, acc.goldMg / 1000) : 1}" aria-label="Grammes à vendre"><span>g</span><b id="p-sell">…</b></label>
          </div>
          <div class="wact">
            <button class="pill" data-act="buy-bar" data-kind="bar">Acheter un lingot</button>
            <label class="wq wq-bar"><select id="bar-id" aria-label="Lingot">${bars().map((p) => `<option value="${p.id}"${p.id === 'lingot-or-10g' ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
              <input type="number" id="q-bar" min="1" max="999" value="1" aria-label="Nombre de lingots"><b id="p-bar">…</b></label>
          </div>
          <div class="wact">
            <button class="pill" data-act="buy-bar" data-kind="coin">Acheter une pièce</button>
            <label class="wq wq-bar"><select id="coin-id" aria-label="Pièce">${coins().map((p) => `<option value="${p.id}"${p.id === '20-fr-coq' ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
              <input type="number" id="q-coin" min="1" max="999" value="1" aria-label="Nombre de pièces"><b id="p-coin">…</b></label>
          </div>
          ${cfg.approvalBuy ? `<p class="approval-note">${ICON.lock.replace('<svg', '<svg class="inline-ico"')} <b>Sécurité :</b> chaque achat est confirmé par votre conseiller. Le prix est bloqué ${cfg.approvalWindowMin} min et le montant mis de côté ; sans validation, tout vous est rendu.</p>` : ''}
          <p class="tiny">Prix en direct : achat <b data-live="gram-buy">…</b>/g · vente <b data-live="gram-sell">…</b>/g. Le lingot acheté est gardé dans votre coffre : vous pouvez le revendre ou vous le faire livrer.</p>
        </div>
      </div>

      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<a role="tab" href="#/compte/${k}" aria-selected="${k === tab}">${l}</a>`).join('')}</div>
      <div class="tab-body">${tabBody(tab)}</div>
    </div>`;
    quote();
    live(view);
  };

  const REQ_TAG = { en_attente: 'tag-en_attente_paiement', validee: '', refusee: 'tag-annulee', expiree: 'tag-annulee', annulee: 'tag-annulee' };
  const notifBlock = () => {
    const unread = acc.notifs.filter((n) => !n.read);
    if (!unread.length) return '';
    return `<div class="notif-box">${unread.slice(0, 4).map((n) => `<p>${ICON.info.replace('<svg', '<svg class="inline-ico"')} ${esc(n.text)} <small>${ago(n.at)}</small></p>`).join('')}<button class="link-small" data-act="read">J'ai vu</button></div>`;
  };
  const pendingBlock = () => {
    const r = acc.requests.filter((x) => x.status === 'en_attente');
    const o = acc.orders.filter((x) => x.status === 'a_valider');
    if (!r.length && !o.length) return '';
    return `<div class="pending-box"><h3>En attente de validation par votre conseiller</h3>
      ${r.map((x) => `<div class="pending-row"><span><b>${esc(REQUEST_KIND[x.kind])} · ${eur(x.amount)}</b><br><small>${esc(x.label)} · ${esc(x.ref)}</small></span>
        <span>prix bloqué encore <b data-until="${x.expiresAt}">${countdown(x.expiresAt)}</b><br><button class="link-small" data-cancel-req="${esc(x.ref)}">Annuler</button></span></div>`).join('')}
      ${o.map((x) => `<div class="pending-row"><span><b>Commande · ${eur(x.total)}</b><br><small>${x.items.map((i) => `${i.qty} × ${esc(i.name)}`).join(', ')}</small></span>
        <span>prix bloqué encore <b data-until="${x.expiresAt}">${countdown(x.expiresAt)}</b><br><a class="link-small" href="#/commande/${esc(x.ref)}">Voir</a></span></div>`).join('')}
    </div>`;
  };

  const tabBody = (t) => {
    if (t === 'demandes') {
      if (!acc.requests.length) return '<p class="muted">Aucune demande pour le moment.</p>';
      return `<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Date</th><th>Opération</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
        ${acc.requests.map((r) => `<tr><td>${date(r.createdAt)}<br><small>${esc(r.ref)}</small></td><td>${esc(REQUEST_KIND[r.kind])}<br><small>${esc(r.label)}</small></td><td>${eur(r.amount)}</td><td><span class="tag ${REQ_TAG[r.status]}">${REQUEST_STATUS[r.status]}</span>${r.note ? `<br><small>${esc(r.note)}</small>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
    }
    if (t === 'coffre') {
      if (!acc.vault.length) return '<p class="muted">Vous n\'avez pas encore de pièces ni de lingots. Achetez-en ci-dessus : ils sont gardés au coffre dans votre porte-monnaie, revendables en un clic ou livrables chez vous.</p>';
      return `<div class="ptable-wrap"><table class="ptable"><thead><tr><th colspan="2">Produit</th><th>Qté</th><th>Valeur métal</th><th>Rachat immédiat</th><th></th></tr></thead><tbody>
        ${acc.vault.map((x) => `<tr><td class="pt-img">${productImage(x.product, 'pimg-row')}</td><td class="pt-name"><b>${esc(x.product.name)}</b></td><td>${x.qty}</td><td>${eur(x.value)}</td><td>${eur(x.buyback)}</td>
          <td class="row-btns"><button class="btn-green" data-sellp="${x.product.id}">Revendre</button><button class="btn-outline" data-deliver="${x.product.id}">Me faire livrer</button></td></tr>`).join('')}
      </tbody></table></div>`;
    }
    if (t === 'historique') {
      if (!acc.ledger.length) return '<p class="muted">Aucune opération.</p>';
      return `<div class="ptable-wrap"><table class="ptable ledger"><thead><tr><th>Date</th><th>Opération</th><th>Montant</th><th>Or</th><th>Solde après</th></tr></thead><tbody>
        ${acc.ledger.map((l) => `<tr><td>${date(l.at)}</td><td>${esc(l.label)}</td><td class="${l.amount > 0 ? 'pos' : l.amount < 0 ? 'neg' : ''}">${l.amount ? (l.amount > 0 ? '+' : '') + eur(l.amount) : '—'}</td>
          <td>${l.goldMg ? (l.goldMg > 0 ? '+' : '') + mg2g(l.goldMg) : '—'}</td><td>${l.cashAfter != null ? eur(l.cashAfter) : ''}</td></tr>`).join('')}
      </tbody></table></div>`;
    }
    if (t === 'commandes') {
      if (!acc.orders.length) return '<p class="muted">Aucune commande pour le moment. <a href="#/investir">Voir les produits</a></p>';
      return `<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Référence</th><th>Date</th><th>Articles</th><th>Total</th><th>Statut</th></tr></thead><tbody>
        ${acc.orders.map((o) => `<tr><td><a href="#/commande/${esc(o.ref)}">${esc(o.ref)}</a></td><td>${date(o.createdAt)}</td><td>${o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join('<br>')}</td><td>${eur(o.total)}</td><td><span class="tag tag-${o.status}">${esc(ORDER_STATUS[o.status])}</span></td></tr>`).join('')}
      </tbody></table></div>`;
    }
    if (t === 'argent') {
      return `<h3>Versements</h3>${acc.deposits.length ? `<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Référence</th><th>Date</th><th>Mode</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
        ${acc.deposits.map((d) => `<tr><td>${esc(d.ref)}</td><td>${date(d.createdAt)}</td><td>${d.method === 'carte' ? 'Carte' : 'Virement'}</td><td>${eur(d.amount)}</td><td>${DEP_STATUS[d.status]}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun versement.</p>'}
        <h3>Retraits</h3>${acc.withdrawals.length ? `<div class="ptable-wrap"><table class="ptable"><thead><tr><th>Référence</th><th>Date</th><th>Vers</th><th>Montant</th><th>Statut</th></tr></thead><tbody>
        ${acc.withdrawals.map((w) => `<tr><td>${esc(w.ref)}</td><td>${date(w.createdAt)}</td><td class="mono">${esc(w.iban.slice(0, 4))}…${esc(w.iban.slice(-4))}</td><td>${eur(w.amount)}</td><td>${WD_STATUS[w.status]}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucun retrait.</p>'}`;
    }
    if (t === 'securite') {
      return `<div class="two-cols">
        <form class="form card" id="pwform"><h3>Changer de mot de passe</h3>
          <label>Mot de passe actuel<input type="password" name="current" required autocomplete="current-password"></label>
          <label>Nouveau mot de passe<input type="password" name="next" required minlength="10" autocomplete="new-password"></label>
          <button class="btn-dark" type="submit">Enregistrer</button>
          <p class="tiny">Les autres appareils connectés seront déconnectés.</p></form>
        <div class="card"><h3>Double authentification</h3>
          ${acc.user.totpEnabled
            ? `<p class="ok">✔ Activée. Un code de votre téléphone est demandé à chaque connexion et pour chaque retrait.</p>
               <form class="form" id="totp-off"><label>Mot de passe<input type="password" name="password" required></label><label>Code actuel<input name="code" inputmode="numeric" maxlength="6" required></label><button class="btn-outline" type="submit">Désactiver</button></form>`
            : `<p>Ajoutez un code à 6 chiffres (Google Authenticator, Microsoft Authenticator, 1Password…) en plus du mot de passe.</p><button class="btn-dark" data-act="totp-setup">Activer</button><div id="totp-zone"></div>`}
        </div></div>
        <p class="tiny">Par sécurité, votre session se ferme après 4 h d'inactivité. Le site ne vous demandera jamais votre mot de passe par e-mail ou téléphone.</p>`;
    }
    if (t === 'infos') {
      const u = acc.user;
      return `<form class="form card grid2" id="profile">
        <label>Prénom<input value="${esc(u.firstName)}" disabled></label><label>Nom<input value="${esc(u.lastName)}" disabled></label>
        <label class="span2">E-mail<input value="${esc(u.email)}" disabled></label>
        <label>Téléphone<input name="phone" value="${esc(u.phone)}" required></label><label>Pays<input name="country" value="${esc(u.country)}"></label>
        <label class="span2">Adresse<input name="address" value="${esc(u.address)}" required></label>
        <label>Code postal<input name="zip" value="${esc(u.zip)}" required></label><label>Ville<input name="city" value="${esc(u.city)}" required></label>
        <p class="span2 tiny">Pour changer de nom ou d'e-mail, contactez-nous avec une pièce d'identité.</p>
        <button class="btn-dark span2" type="submit">Enregistrer</button></form>`;
    }
    return '';
  };

  function quote() {
    const p = S.prices;
    if (!p || !p.available) return;
    const g = (id) => Math.max(0, Number(String($(id, view)?.value || '0').replace(',', '.')) || 0);
    $('#p-buy', view).textContent = eur(Math.round(g('#q-buy') * p.gramBuy));
    $('#p-sell', view).textContent = eur(Math.floor(g('#q-sell') * p.gramSell));
    const bar = S.byId[$('#bar-id', view)?.value];
    const n = Math.max(1, parseInt($('#q-bar', view)?.value, 10) || 1);
    if (bar) $('#p-bar', view).textContent = eur((bar.tiers ? unitFor(bar, n) : bar.price) * n);
    const coin = S.byId[$('#coin-id', view)?.value];
    const nc = Math.max(1, parseInt($('#q-coin', view)?.value, 10) || 1);
    if (coin) $('#p-coin', view).textContent = eur((coin.tiers ? unitFor(coin, nc) : coin.price) * nc);
  }
  const unitFor = (p, n) => { let u = p.tiers[0].unit; for (const t of p.tiers) if (n >= t.min) u = t.unit; return u; };

  async function refresh() {
    acc = await get('/api/account');
    paint();
  }

  // Fenêtre de confirmation : montre le prix exact avant d'engager l'argent.
  // Deuxième étape : fenêtre de confirmation avec le montant exact.
  function confirmTrade(title, lines, onOk, { what = title, amount = 0, buying = true } = {}) {
    const approval = buying ? cfg.approvalBuy : cfg.approvalSell;
    track('trade_open', { what, amount });
    let done = false;
    const m = modal(`<h2>${title}</h2><dl class="kv">${lines.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${approval ? `<p class="approval-note"><b>Votre conseiller confirme ensuite l'opération.</b> Le prix est bloqué ${cfg.approvalWindowMin} min et le montant mis de côté. Vous êtes prévenu dès la validation.</p>` : ''}
      <p class="tiny">Prix au cours actuel. S'il bouge de plus de ${num2((S.config?.maxPriceMove ?? 0.005) * 100)} % avant validation, on vous montre le nouveau prix.</p>
      <div class="modal-btns"><button class="btn-outline" data-x>Annuler</button><button class="btn-buy" data-ok>${approval ? 'Envoyer' : 'Confirmer'}</button></div>`,
    { onClose: () => { if (!done) track('trade_cancel', { what }); } });
    m.el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-x]')) m.close();
      const ok = e.target.closest('[data-ok]');
      if (!ok) return;
      await busy(ok, async () => {
        try {
          const r = await onOk();
          done = true;
          m.close(true);
          if (r && r.pending) {
            modal(`<h2>Demande envoyée</h2><p>Votre conseiller va la valider. Prix bloqué jusqu'à <b>${time(r.request.expiresAt)}</b>.</p>
              <p class="tiny">Référence ${esc(r.request.ref)}. Vous serez prévenu ici dès la validation.</p>
              <p><a class="btn-wa" href="${shopWa(`je viens d'envoyer la demande ${r.request.ref} (${what}).`)}" target="_blank" rel="noopener">${ICON.whatsapp} Prévenir mon conseiller</a></p>`);
          }
          await Promise.all([loadProducts().catch(() => {}), refresh()]);
        }
        catch (err) {
          toast(err.message, 'err');
          if (err.status === 409) { await loadPrices(); await loadProducts().catch(() => {}); m.close(); paint(); }
        }
      });
    });
  }

  const actions = {
    read() { post('/api/notifs/read').catch(() => {}); acc.notifs = acc.notifs.map((n) => ({ ...n, read: true })); paint(); },
    async logout() { await post('/api/auth/logout'); await loadMe(); toast('Vous êtes déconnecté.'); go('#/'); },
    'buy-gram'() {
      const g = Number(String($('#q-buy', view).value).replace(',', '.'));
      if (!(g >= cfg.minGramTrade)) return toast(`Minimum ${String(cfg.minGramTrade).replace('.', ',')} g.`, 'err');
      const unit = S.prices.gramBuy;
      confirmTrade('Acheter de l\'or au gramme', [['Quantité', gramsNum(g) + ' g'], ['Prix du gramme', eur(unit)], ['Total débité', `<b>${eur(Math.round(g * unit))}</b>`], ['Solde actuel', eur(acc.cash)]], async () => {
        const r = await post('/api/wallet/buy-gold', { grams: g, expected: unit });
        if (!r.pending) toast(`Achat confirmé : ${mg2g(r.mg)} pour ${eur(r.amount)}.`);
        return r;
      }, { what: `achat de ${gramsNum(g)} g d'or`, amount: Math.round(g * unit) });
    },
    'sell-gram'() {
      const g = Number(String($('#q-sell', view).value).replace(',', '.'));
      if (!(g > 0)) return toast('Quantité invalide.', 'err');
      if (g * 1000 > acc.goldMg) return toast(`Vous avez ${mg2g(acc.goldMg)} sur votre compte.`, 'err');
      const unit = S.prices.gramSell;
      const all = Math.round(g * 1000) >= acc.goldMg;
      confirmTrade('Vendre de l\'or au gramme', [['Quantité', gramsNum(g) + ' g'], ['Prix du gramme', eur(unit)], ['Total crédité', `<b>${eur(Math.floor(g * unit))}</b>`]], async () => {
        const r = await post('/api/wallet/sell-gold', { grams: g, all, expected: unit });
        if (!r.pending) toast(`Vente confirmée : ${eur(r.amount)} crédités sur votre solde.`);
        return r;
      }, { what: `vente de ${gramsNum(g)} g d'or`, amount: Math.floor(g * unit), buying: false });
    },
    'buy-bar'(btn) {
      const coin = btn.dataset.kind === 'coin';
      const p = S.byId[$(coin ? '#coin-id' : '#bar-id', view).value];
      const n = Math.max(1, parseInt($(coin ? '#q-coin' : '#q-bar', view).value, 10) || 1);
      if (!p) return;
      const unit = unitFor(p, n);
      confirmTrade(`Acheter ${esc(p.name)}`, [['Quantité', n], ['Prix unitaire', eur(unit)], ['Total débité', `<b>${eur(unit * n)}</b>`], ['Où ?', 'Dans votre porte-monnaie, gardé au coffre (gratuit) : revendable en un clic ou livrable']], async () => {
        const r = await post('/api/wallet/buy-product', { productId: p.id, qty: n, expected: unit });
        if (!r.pending) toast(`${n} × ${p.name} ajouté(s) à votre porte-monnaie.`);
        return r;
      }, { what: `achat de ${n} × ${p.name}`, amount: unit * n });
    },
    deposit() {
      const card = S.config?.cardEnabled;
      const m = modal(`<h2>Alimenter mon compte</h2>
        <form class="form" id="dep"><label>Montant (€)<input type="number" name="amount" min="10" step="1" required value="500"></label>
        <fieldset class="radios"><legend>Mode</legend>
          ${card ? '<label><input type="radio" name="method" value="carte" checked> Carte bancaire (immédiat)</label>' : ''}
          <label><input type="radio" name="method" value="virement"${card ? '' : ' checked'}> Virement bancaire (1 à 2 jours ouvrés)</label></fieldset>
        <button class="btn-buy" type="submit">Continuer</button></form><div id="dep-out"></div>`);
      $('#dep', m.el).addEventListener('submit', async (e) => {
        e.preventDefault();
        await busy($('button', e.target), async () => {
          try {
            const r = await post('/api/wallet/deposit', formData(e.target));
            if (r.redirect) { location.href = r.redirect; return; }
            if (r.instant) { toast(`${eur(r.deposit.amount)} ajoutés à votre solde.`); m.close(); refresh(); return; }
            e.target.hidden = true;
            $('#dep-out', m.el).innerHTML = `<p>Faites un virement de <b>${eur(r.deposit.amount)}</b> vers :</p>
              <dl class="kv"><dt>Bénéficiaire</dt><dd>${esc(r.bank.holder)}</dd><dt>IBAN</dt><dd class="mono">${esc(r.bank.iban)}</dd><dt>BIC</dt><dd class="mono">${esc(r.bank.bic)}</dd><dt>Référence</dt><dd class="mono"><b>${esc(r.bank.ref)}</b></dd></dl>
              <p class="tiny">Indiquez impérativement la référence. Votre solde est crédité dès réception.</p>`;
            refresh();
          } catch (err) { toast(err.message, 'err'); }
        });
      });
    },
    withdraw() {
      const m = modal(`<h2>Retirer vers mon compte bancaire</h2>
        <p>Disponible : <b>${eur(acc.cash)}</b></p>
        <form class="form" id="wd">
          <label>Montant (€)<input type="number" name="amount" min="10" step="0.01" max="${acc.cash / 100}" required></label>
          <label>Titulaire du compte<input name="holder" required value="${esc(acc.user.firstName + ' ' + acc.user.lastName)}"></label>
          <label>IBAN<input name="iban" required placeholder="FR76 …" autocomplete="off"></label>
          <label>Mot de passe (confirmation)<input type="password" name="password" required autocomplete="current-password"></label>
          ${acc.user.totpEnabled ? '<label>Code de double authentification<input name="code" inputmode="numeric" maxlength="6" required></label>' : ''}
          <button class="btn-buy" type="submit">Demander le retrait</button>
          <p class="tiny">Le virement part sous 1 à 2 jours ouvrés, uniquement vers un compte à votre nom.</p></form>`);
      $('#wd', m.el).addEventListener('submit', async (e) => {
        e.preventDefault();
        await busy($('button', e.target), async () => {
          try { const r = await post('/api/wallet/withdraw', formData(e.target)); toast(`Retrait ${r.withdrawal.ref} enregistré.`); m.close(); refresh(); }
          catch (err) { toast(err.message, 'err'); }
        });
      });
    },
    async 'totp-setup'(btn) {
      await busy(btn, async () => {
        try {
          const r = await post('/api/auth/2fa/setup');
          const zone = $('#totp-zone', view);
          zone.innerHTML = `<ol class="small-steps"><li>Ouvrez votre application d'authentification et scannez ce code (ou <a href="${esc(r.uri)}">touchez ici sur téléphone</a>) :</li></ol>
            <div id="qr" class="qr"></div><p class="tiny">Clé manuelle : <span class="mono">${esc(r.secret.replace(/(.{4})/g, '$1 ').trim())}</span></p>
            <form class="form" id="totp-on"><label>Code affiché<input name="code" inputmode="numeric" maxlength="6" required autocomplete="one-time-code"></label><button class="btn-dark" type="submit">Valider</button></form>`;
          drawQr($('#qr', zone), r.uri);
        } catch (err) { toast(err.message, 'err'); }
      });
    },
  };

  view.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-act]');
    if (a && actions[a.dataset.act]) { actions[a.dataset.act](a); return; }
    const sp = e.target.closest('[data-sellp]');
    if (sp) {
      const item = acc.vault.find((x) => x.product.id === sp.dataset.sellp);
      const m = modal(`<h2>Revendre ${esc(item.product.name)}</h2>
        <form class="form" id="sp"><label>Quantité (vous en avez ${item.qty})<input type="number" name="qty" min="1" max="${item.qty}" value="${item.qty}" required></label>
        <p>Prix de rachat : <b>${eur(item.product.buyback)}</b> l'unité (valeur métal − ${num2(cfg.buybackSpread * 100)} %).</p>
        <button class="btn-buy" type="submit">Revendre et créditer mon solde</button></form>`);
      $('#sp', m.el).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        await busy($('button', ev.target), async () => {
          try {
            const r = await post('/api/wallet/sell-product', { productId: item.product.id, qty: Number(ev.target.qty.value), expected: item.product.buyback });
            toast(r.pending ? `Demande ${r.request.ref} envoyée à votre conseiller.` : `${eur(r.amount)} crédités sur votre solde.`); m.close();
            await loadProducts().catch(() => {}); refresh();
          } catch (err) { toast(err.message, 'err'); if (err.status === 409) { m.close(); refresh(); } }
        });
      });
      return;
    }
    const dv = e.target.closest('[data-deliver]');
    if (dv) deliverModal(dv.dataset.deliver);
  });

  function deliverModal(firstId) {
    const u = acc.user;
    const m = modal(`<h2>Me faire livrer mon or</h2>
      <form class="form" id="dl">
        ${acc.vault.map((x) => `<label class="row-inline">${esc(x.product.name)} <input type="number" name="q-${x.product.id}" min="0" max="${x.qty}" value="${x.product.id === firstId ? x.qty : 0}"> / ${x.qty}</label>`).join('')}
        <fieldset class="radios"><legend>Mode</legend>
          <label><input type="radio" name="delivery" value="domicile" checked> Livraison assurée à domicile (${eur(cfg.shippingFee)}, offerte dès ${eur(cfg.freeShippingFrom)} de valeur)</label>
          <label><input type="radio" name="delivery" value="boutique"> Retrait en boutique (gratuit)</label></fieldset>
        <div class="grid2" id="dl-addr">
          <label>Nom complet<input name="name" value="${esc(u.firstName + ' ' + u.lastName)}"></label><label>Téléphone<input name="phone" value="${esc(u.phone)}"></label>
          <label class="span2">Adresse<input name="address" value="${esc(u.address)}"></label><label>Code postal<input name="zip" value="${esc(u.zip)}"></label><label>Ville<input name="city" value="${esc(u.city)}"></label></div>
        <button class="btn-buy" type="submit">Confirmer</button></form>`, { wide: true });
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

  view.addEventListener('input', (e) => { if (['q-buy', 'q-sell', 'q-bar', 'q-coin'].includes(e.target.id)) quote(); });
  view.addEventListener('change', (e) => { if (['bar-id', 'coin-id'].includes(e.target.id)) quote(); });
  view.addEventListener('submit', async (e) => {
    const f = e.target;
    if (!['pwform', 'totp-on', 'totp-off', 'profile'].includes(f.id)) return;
    e.preventDefault();
    const url = { pwform: '/api/auth/password', 'totp-on': '/api/auth/2fa/enable', 'totp-off': '/api/auth/2fa/disable', profile: '/api/auth/profile' }[f.id];
    await busy($('button[type=submit]', f), async () => {
      try {
        await post(url, formData(f));
        toast({ pwform: 'Mot de passe modifié.', 'totp-on': 'Double authentification activée.', 'totp-off': 'Double authentification désactivée.', profile: 'Informations enregistrées.' }[f.id]);
        await loadMe(); refresh();
      } catch (err) { toast(err.message, 'err'); }
    });
  });

  view.addEventListener('click', async (e) => {
    const cr = e.target.closest('[data-cancel-req]');
    if (!cr || !(await ask('Annuler cette demande ? Le montant réservé vous est rendu.', { ok: 'Annuler la demande', cancel: 'Garder' }))) return;
    await busy(cr, async () => { try { await post(`/api/requests/${encodeURIComponent(cr.dataset.cancelReq)}/cancel`); toast('Demande annulée.'); await loadProducts().catch(() => {}); refresh(); } catch (err) { toast(err.message, 'err'); } });
  });

  paint();
  const off = on('prices', quote);
  // Comptes à rebours et vérification régulière des validations du conseiller.
  const tick = setInterval(() => { $$('[data-until]', view).forEach((el) => { el.textContent = countdown(el.dataset.until); }); }, 1000);
  const poll = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const next = await get('/api/account');
      const fresh = next.notifs.filter((n) => !n.read && !acc.notifs.some((o) => o.id === n.id));
      acc = next;
      if (!fresh.length) return;
      fresh.forEach((n) => toast(n.text));
      const typing = $('.modal-back') || (document.activeElement && view.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
      if (!typing) paint();
    } catch { /* réseau */ }
  }, 15000);
  return () => { off(); clearInterval(tick); clearInterval(poll); };
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
