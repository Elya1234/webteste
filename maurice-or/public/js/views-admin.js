// Espace administrateur : validation des achats (deuxième confirmation), activité des
// clients en direct, abandons, fiches clients, commandes, versements, retraits,
// produits, messages et réglages.
import { S, loadProducts, loadConfig, loadMe } from './store.js';
import { get, post, put } from './api.js';
import { $, $$, esc, eur, num2, toast, busy, formData, date, time, ago, gramsNum, ICON, waLink, countdown } from './ui.js';
import { go, paintIcons } from './app.js';
import { ORDER_STATUS, REQUEST_STATUS, REQUEST_KIND } from './shared/core.js';

const NAV = [
  ['', 'Tableau de bord', 'home'], ['valider', 'À valider', 'check'], ['activite', 'Activité en direct', 'activity'],
  ['abandons', 'Abandons & intentions', 'eye'], ['clients', 'Clients', 'users'], ['commandes', 'Commandes', 'bag'],
  ['versements', 'Versements', 'in'], ['retraits', 'Retraits', 'out'], ['produits', 'Produits & prix', 'coins'],
  ['messages', 'Messages', 'mail'], ['reglages', 'Réglages', 'settings'],
];
const DELIV = { domicile: 'Livraison', boutique: 'Boutique', coffre: 'Coffre' };
const PAY = { solde: 'Solde', carte: 'Carte', virement: 'Virement' };
const g = (mg) => gramsNum(mg / 1000) + ' g';

// Couleur d'un événement dans le fil d'activité.
const evClass = (t) => (/^(request_created|order_created|trade|deposit|withdraw|order_paid)/.test(t) ? 't-money'
  : /^(cart|checkout|product_view|trade_open|trade_cancel)/.test(t) ? 't-cart'
    : /(failed|locked|security)/.test(t) ? 't-sec'
      : /(approved|validated|done|register)/.test(t) ? 't-ok' : '');
const EV_FILTERS = [
  ['tout', 'Tout'], ['money', 'Achats & ventes'], ['cart', 'Navigation & panier'], ['auth', 'Connexions'], ['sec', 'Sécurité'],
];
const evMatch = (f, e) => f === 'tout' || (f === 'money' && evClass(e.type) === 't-money') || (f === 'cart' && evClass(e.type) === 't-cart')
  || (f === 'auth' && /^(login|logout|register)/.test(e.type)) || (f === 'sec' && evClass(e.type) === 't-sec');

export function adminShell(active, d, content, title, sub = '') {
  const count = (k) => ({ valider: d?.stats.toApprove, commandes: d?.stats.ordersToHandle, versements: d?.deposits.filter((x) => x.status === 'en_attente').length,
    retraits: d?.withdrawals.filter((x) => x.status === 'en_attente').length, messages: d?.messages.filter((m) => !m.handled).length, abandons: d?.intentions.length }[k]);
  return `<div class="app">
    <aside class="app-side">
      <div class="who"><span class="avatar">${esc((S.me.firstName[0] || 'A') + (S.me.lastName[0] || ''))}</span><div><b>Administration</b><span>${esc(S.me.firstName)} · ${d ? `${d.stats.online} client(s) en ligne` : ''}</span></div></div>
      ${NAV.map(([k, l, ico]) => { const n = count(k); return `<a href="#/admin${k ? '/' + k : ''}" class="${k === active ? 'is-active' : ''}">${ICON[ico]}${l}${n ? `<span class="count">${n}</span>` : ''}</a>`; }).join('')}
      <div class="side-sep"></div>
      <a href="#/">${ICON.home}Voir le site</a>
      <button class="side-link" data-logout>${ICON.logout}Se déconnecter</button>
    </aside>
    <div class="app-main">
      <div class="app-top"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="app-top-right"><span class="chip chip-ok chip-dot">Mise à jour automatique</span></div></div>
      ${content}
    </div>
  </div>`;
}

function feed(events, { withClient = true } = {}) {
  if (!events.length) return `<div class="empty">${ICON.activity}Rien pour le moment.</div>`;
  return `<ul class="feed">${events.map((e) => `<li class="${evClass(e.type)}"><time title="${date(e.at)}">${new Date(e.at).toDateString() === new Date().toDateString() ? time(e.at) : new Date(e.at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</time><span class="fdot"></span>
    <span>${withClient ? (e.userId ? `<a class="who-link" href="#/admin/client/${e.userId}">${esc(e.client)}</a> · ` : '<b>Visiteur</b> · ') : ''}${esc(e.label)}</span></li>`).join('')}</ul>`;
}

function waClient(phone, name, text) {
  return phone ? `<a class="btn btn-wa btn-sm" href="${waLink(phone, `Bonjour ${name}, ${text}`)}" target="_blank" rel="noopener">${ICON.whatsapp}WhatsApp</a>` : '';
}

function approvals(d) {
  const reqs = d.requests.filter((r) => r.status === 'en_attente');
  const ords = d.orders.filter((o) => o.status === 'a_valider');
  if (!reqs.length && !ords.length) return `<div class="panel"><div class="empty">${ICON.check}<p>Rien à valider. Les nouvelles demandes apparaissent ici automatiquement.</p></div></div>`;
  const gap = (locked, now, buying) => {
    if (now == null) return '';
    const diff = (now - locked) / locked * 100;
    const bad = buying ? diff > 0.5 : diff < -0.5;
    return `<div><span>Au cours actuel</span><b>${eur(now)}</b><small class="${bad ? 'down' : 'up'}">${diff > 0 ? '+' : ''}${num2(diff)} %</small></div>`;
  };
  const first = (c) => String(c || '').split(' ')[0];
  return reqs.map((r) => `<div class="approve">
      <div>
        <h3>${esc(REQUEST_KIND[r.kind])} · ${eur(r.amount)}</h3>
        <div class="meta"><a class="who-link" href="#/admin/client/${r.userId}">${esc(r.client)}</a><span>${esc(r.ref)}</span><span>${ago(r.createdAt)}</span><span>Expire dans <b class="timer" data-until="${r.expiresAt}">${countdown(r.expiresAt)}</b></span></div>
        <div class="prices"><div><span>Détail</span><b>${esc(r.label)}</b></div><div><span>Prix bloqué</span><b>${eur(r.amount)}</b></div>${gap(r.amount, r.current, r.kind.startsWith('buy'))}</div>
      </div>
      <div class="acts">${waClient(r.phone, first(r.client), `concernant votre demande ${r.ref}.`)}<button class="btn btn-red btn-sm" data-req="${r.id}" data-a="refuse">Refuser</button><button class="btn btn-green" data-req="${r.id}" data-a="approve">${ICON.check}Valider</button></div>
    </div>`).join('') + ords.map((o) => `<div class="approve">
      <div>
        <h3>Commande · ${eur(o.total)}</h3>
        <div class="meta"><a class="who-link" href="#/admin/client/${o.userId}">${esc(o.client)}</a><span>${esc(o.ref)}</span><span>${ago(o.createdAt)}</span><span>Expire dans <b class="timer" data-until="${o.expiresAt}">${countdown(o.expiresAt)}</b></span></div>
        <div class="prices"><div><span>Articles</span><b>${o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join(', ')}</b></div><div><span>${DELIV[o.delivery]} · ${PAY[o.payment]}</span><b>${eur(o.total)}</b></div>${gap(o.total, o.current, true)}</div>
      </div>
      <div class="acts">${waClient(o.phone, first(o.client), `concernant votre commande ${o.ref}.`)}<button class="btn btn-red btn-sm" data-ord="${esc(o.ref)}" data-st="refuser">Refuser</button><button class="btn btn-green" data-ord="${esc(o.ref)}" data-st="valider">${ICON.check}Valider</button></div>
    </div>`).join('');
}

function intentionsTable(list) {
  if (!list.length) return `<div class="empty">${ICON.eye}<p>Aucun abandon en ce moment.</p></div>`;
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Ce qu'il faisait</th><th>Panier en cours</th><th>Dernière visite</th><th></th></tr></thead><tbody>
    ${list.map((i) => `<tr><td>${i.userId ? `<a href="#/admin/client/${i.userId}">${esc(i.who)}</a>` : `<b>${esc(i.who)}</b>`}</td>
      <td>${esc(i.label)}<br><small>${ago(i.at)}</small></td>
      <td>${i.cart.length ? `${i.cart.map((l) => `${l.qty} × ${esc(l.name)}`).join('<br>')}<br><b>${eur(i.cartValue)}</b>` : '<small>—</small>'}</td>
      <td>${ago(i.lastSeen)}</td>
      <td>${waClient(i.phone, i.who.split(' ')[0], `nous avons vu que vous vous intéressiez à nos produits${i.cart.length ? ` (${i.cart.map((l) => l.name).join(', ')})` : ''}. Puis-je vous aider ou répondre à une question ?`)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

export async function adminPage(view, { tab = '' }) {
  if (!S.me) { go('#/connexion?next=/admin'); return; }
  if (S.me.role !== 'admin') { view.innerHTML = '<div class="page"><h1 class="h1">Accès réservé</h1></div>'; return; }
  if (!NAV.some((n) => n[0] === tab)) tab = '';
  let d = await get('/api/admin/overview');
  let evFilter = 'tout', search = '';

  const body = () => {
    const s = d.stats;
    if (tab === '') {
      return `<div class="kpis">
          <a class="kpi hot" href="#/admin/valider"><span>À valider</span><b>${s.toApprove}</b><small>demandes et commandes</small></a>
          <a class="kpi" href="#/admin/clients"><span>Clients en ligne</span><b>${s.online}</b><small>sur ${s.users} clients</small></a>
          <a class="kpi" href="#/admin/commandes"><span>Commandes en cours</span><b>${s.ordersToHandle}</b><small>à préparer / expédier</small></a>
          <a class="kpi" href="#/admin/abandons"><span>Abandons</span><b>${d.intentions.length}</b><small>clients à relancer</small></a>
          <div class="kpi"><span>Or détenu par les clients</span><b>${g(s.goldOwedMg)}</b><small>à couvrir en stock</small></div>
          <div class="kpi"><span>Soldes clients</span><b>${eur(s.cashOwed)}</b><small>à garder en banque</small></div>
        </div>
        <div class="dash-grid" style="margin-top:0">
          <div><div class="panel-head"><h2>À valider maintenant</h2><a href="#/admin/valider">Tout voir</a></div>${approvals(d)}</div>
          <div class="panel"><div class="panel-head"><h2>Activité en direct</h2><a href="#/admin/activite">Tout voir</a></div>${feed(d.events.slice(0, 14))}</div>
        </div>`;
    }
    if (tab === 'valider') return `<p class="muted" style="margin-top:-12px">Chaque achat d'un client attend votre accord. Le prix est bloqué et l'argent du client est mis de côté pendant ${d.settings.approvalWindowMin} min ; sans réponse, tout lui est rendu automatiquement.</p>${approvals(d)}`;
    if (tab === 'activite') {
      const list = d.events.filter((e) => evMatch(evFilter, e) && (!search || (e.client + ' ' + e.label).toLowerCase().includes(search)));
      return `<div class="filters"><div class="seg">${EV_FILTERS.map(([k, l]) => `<button data-evf="${k}" aria-pressed="${k === evFilter}">${l}</button>`).join('')}</div>
        <input class="input search" id="ev-search" placeholder="Rechercher un client, un produit…" value="${esc(search)}"></div>
        <div class="panel">${feed(list.slice(0, 300))}</div>`;
    }
    if (tab === 'abandons') return `<p class="muted" style="margin-top:-12px">Clients et visiteurs qui ont commencé quelque chose (panier, commande, achat au gramme) sans aller au bout. Un message WhatsApp au bon moment fait souvent la différence.</p><div class="panel">${intentionsTable(d.intentions)}</div>`;
    if (tab === 'clients') {
      const list = d.users.filter((u) => !search || `${u.name} ${u.email} ${u.clientNo} ${u.phone} ${u.city}`.toLowerCase().includes(search));
      return `<div class="filters"><input class="input search" id="cl-search" placeholder="Nom, e-mail, n° client, téléphone…" value="${esc(search)}"></div>
        <div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Contact</th><th>Solde</th><th>Or</th><th>Panier</th><th>Dernière visite</th><th>Sécurité</th></tr></thead><tbody>
        ${list.map((u) => `<tr><td><span class="online-dot ${u.online ? 'on' : ''}"></span><a href="#/admin/client/${u.id}">${esc(u.name)}</a><br><small>${u.clientNo} · ${esc(u.city)}${u.role === 'admin' ? ' · admin' : ''}</small></td>
          <td>${esc(u.email)}<br><small>${esc(u.phone)}</small></td><td>${eur(u.cash)}</td><td>${g(u.goldMg)}</td><td>${u.cartCount ? `${u.cartCount} article(s)` : '—'}</td>
          <td>${u.online ? '<span class="chip chip-ok">En ligne</span>' : ago(u.lastSeen)}</td><td>${u.totp ? '<span class="chip chip-ok">Code activé</span>' : '<small>Mot de passe</small>'}</td></tr>`).join('') || '<tr><td colspan="7">Aucun client.</td></tr>'}
        </tbody></table></div></div>`;
    }
    if (tab === 'commandes') {
      return `<div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Commande</th><th>Client</th><th>Articles</th><th>Total</th><th>Mode</th><th>Statut</th><th>Action</th></tr></thead><tbody>
        ${d.orders.map((o) => `<tr><td><a href="#/commande/${esc(o.ref)}">${esc(o.ref)}</a><br><small>${date(o.createdAt)}${o.kind === 'coffre' ? ' · sortie coffre' : ''}</small></td>
          <td><a href="#/admin/client/${o.userId}">${esc(o.client)}</a></td><td>${o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join('<br>')}</td><td><b>${eur(o.total)}</b></td>
          <td>${DELIV[o.delivery]} · ${PAY[o.payment]}${o.address ? `<br><small>${esc(o.address.name)}, ${esc(o.address.address)}, ${esc(o.address.zip)} ${esc(o.address.city)} ${esc(o.address.phone || '')}</small>` : ''}</td>
          <td><span class="chip ${['annulee', 'refusee', 'expiree'].includes(o.status) ? 'chip-err' : ['a_valider', 'en_attente_paiement'].includes(o.status) ? 'chip-wait' : 'chip-ok'}">${esc(ORDER_STATUS[o.status])}</span>${o.tracking ? `<br><small>${esc(o.tracking)}</small>` : ''}</td>
          <td style="white-space:nowrap">${orderActions(o)}</td></tr>`).join('') || '<tr><td colspan="7">Aucune commande.</td></tr>'}
        </tbody></table></div></div>`;
    }
    if (tab === 'versements') {
      return `<p class="muted" style="margin-top:-12px">Quand un virement arrive sur le compte bancaire, vérifiez la référence et créditez le client.</p><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Référence</th><th>Client</th><th>Mode</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>
        ${d.deposits.map((x) => `<tr><td><b>${esc(x.ref)}</b><br><small>${date(x.createdAt)}</small></td><td><a href="#/admin/client/${x.userId}">${esc(x.client)}</a></td><td>${x.method}</td><td><b>${eur(x.amount)}</b></td>
          <td><span class="chip ${x.status === 'en_attente' ? 'chip-wait' : x.status === 'validee' ? 'chip-ok' : 'chip-err'}">${{ en_attente: 'En attente', validee: 'Crédité', refusee: 'Refusé' }[x.status]}</span></td>
          <td style="white-space:nowrap">${x.status === 'en_attente' ? `<button class="btn btn-green btn-sm" data-dep="${x.id}" data-a="validate">Reçu → créditer</button> <button class="btn btn-red btn-sm" data-dep="${x.id}" data-a="refuse">Refuser</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Aucun versement.</td></tr>'}
        </tbody></table></div></div>`;
    }
    if (tab === 'retraits') {
      return `<p class="muted" style="margin-top:-12px">Le montant est déjà retiré du solde du client. Faites le virement, puis marquez-le comme envoyé.</p><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Référence</th><th>Client</th><th>Titulaire / IBAN</th><th>Montant</th><th>Statut</th><th></th></tr></thead><tbody>
        ${d.withdrawals.map((x) => `<tr><td><b>${esc(x.ref)}</b><br><small>${date(x.createdAt)}</small></td><td><a href="#/admin/client/${x.userId}">${esc(x.client)}</a></td><td>${esc(x.holder)}<br><span class="mono">${esc(x.iban)}</span></td><td><b>${eur(x.amount)}</b></td>
          <td><span class="chip ${x.status === 'en_attente' ? 'chip-wait' : x.status === 'effectue' ? 'chip-ok' : 'chip-err'}">${{ en_attente: 'À faire', effectue: 'Envoyé', refuse: 'Refusé' }[x.status]}</span></td>
          <td style="white-space:nowrap">${x.status === 'en_attente' ? `<button class="btn btn-green btn-sm" data-wd="${x.id}" data-a="done">Virement fait</button> <button class="btn btn-red btn-sm" data-wd="${x.id}" data-a="refuse">Refuser</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">Aucun retrait.</td></tr>'}
        </tbody></table></div></div>`;
    }
    if (tab === 'produits') {
      return `<p class="muted" style="margin-top:-12px">Marge = pourcentage ajouté à la valeur du métal. « 0 % » vend au prix du métal (sans marge).</p>
        <div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Produit</th><th>Valeur métal</th><th>Prix</th><th>Marge %</th><th>Stock</th><th>Offre 0 %</th><th>Visible</th><th></th></tr></thead><tbody>
        ${d.products.map((p) => `<tr data-pid="${p.id}"><td><b>${esc(p.name)}</b></td><td>${p.metalValue ? eur(p.metalValue) : '…'}</td><td>${p.price ? eur(p.price) : '…'}</td>
          <td><input class="in-sm" type="number" step="0.1" name="premium" value="${Math.round(p.premium * 1000) / 10}"></td>
          <td><input class="in-sm" type="number" step="1" min="0" name="stock" value="${p.stock}"></td>
          <td><label class="switch"><input type="checkbox" name="offer"${p.offer ? ' checked' : ''}><i></i></label></td><td><label class="switch"><input type="checkbox" name="active"${p.active ? ' checked' : ''}><i></i></label></td>
          <td><button class="btn btn-ink btn-sm" data-save-p>Enregistrer</button></td></tr>`).join('')}
        </tbody></table></div></div>`;
    }
    if (tab === 'messages') {
      return d.messages.map((m) => `<div class="panel" style="${m.handled ? 'opacity:.6' : ''}"><div class="panel-head"><h2>${esc(m.subject || 'Message')}</h2><span class="tiny">${date(m.createdAt)}</span></div>
        <p class="small"><b>${esc(m.name)}</b> · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ` · ${esc(m.phone)}` : ''}</p><p style="white-space:pre-wrap">${esc(m.message)}</p>
        <div class="buy-row">${waClient(m.phone, m.name.split(' ')[0], 'suite à votre message sur notre site : ')}${m.handled ? '<span class="chip chip-ok">Traité</span>' : `<button class="btn btn-light btn-sm" data-msg="${m.id}">Marquer comme traité</button>`}</div></div>`).join('') || `<div class="panel"><div class="empty">${ICON.mail}Aucun message.</div></div>`;
    }
    if (tab === 'reglages') {
      const st = d.settings;
      const pc = (v) => Math.round(v * 10000) / 100;
      return `<form id="settings">
        <div class="panel"><h2 class="h3">Validation des opérations</h2>
          <div class="toggle-row"><div><b>Deuxième confirmation des achats</b><small>Chaque achat d'un client (or au gramme, lingot, commande) attend votre validation.</small></div><label class="switch"><input type="checkbox" name="approvalBuy"${st.approvalBuy ? ' checked' : ''}><i></i></label></div>
          <div class="toggle-row"><div><b>Deuxième confirmation des ventes</b><small>Les reventes des clients attendent aussi votre validation.</small></div><label class="switch"><input type="checkbox" name="approvalSell"${st.approvalSell ? ' checked' : ''}><i></i></label></div>
          <div class="toggle-row"><div><b>Délai de validation (minutes)</b><small>Passé ce délai, la demande expire et l'argent est rendu au client.</small></div><input class="in-sm" type="number" name="approvalWindowMin" min="5" value="${st.approvalWindowMin}"></div>
        </div>
        <div class="panel form grid2"><h2 class="h3 span2">Contact</h2>
          <label>Numéro WhatsApp (format international, ex. 33612345678)<input name="whatsapp" value="${esc(st.whatsapp)}"></label><label>Téléphone<input name="shopPhone" value="${esc(st.shopPhone)}"></label>
          <label>Nom de la boutique<input name="shopName" value="${esc(st.shopName)}"></label><label>E-mail<input name="shopEmail" value="${esc(st.shopEmail)}"></label>
          <label class="span2">Adresse<input name="shopAddress" value="${esc(st.shopAddress)}"></label><label class="span2">Horaires<input name="shopHours" value="${esc(st.shopHours)}"></label></div>
        <div class="panel form grid2"><h2 class="h3 span2">Marges et livraison</h2>
          <label>Achat au gramme : cours + (%)<input type="number" step="0.01" name="gramBuySpread" value="${pc(st.gramBuySpread)}"></label>
          <label>Vente au gramme : cours − (%)<input type="number" step="0.01" name="gramSellSpread" value="${pc(st.gramSellSpread)}"></label>
          <label>Rachat des produits du coffre : métal − (%)<input type="number" step="0.01" name="buybackSpread" value="${pc(st.buybackSpread)}"></label>
          <label>Écart de cours toléré à la validation (%)<input type="number" step="0.01" name="maxPriceMove" value="${pc(st.maxPriceMove)}"></label>
          <label>Minimum par opération au gramme (g)<input type="number" step="0.01" name="minGramTrade" value="${st.minGramTrade}"></label>
          <label>Bloquer les achats si le cours a plus de (minutes)<input type="number" name="staleAfterMin" value="${st.staleAfterMin}"></label>
          <label>Frais de livraison assurée (€)<input type="number" step="0.01" name="shippingFee" value="${st.shippingFee / 100}"></label>
          <label>Livraison offerte dès (€)<input type="number" step="1" name="freeShippingFrom" value="${st.freeShippingFrom / 100}"></label></div>
        <div class="panel form grid2"><h2 class="h3 span2">Coordonnées bancaires (virements des clients)</h2>
          <label>Titulaire<input name="bankHolder" value="${esc(st.bankHolder)}"></label><label>BIC<input name="bankBic" value="${esc(st.bankBic)}"></label>
          <label class="span2">IBAN<input name="bankIban" value="${esc(st.bankIban)}"></label></div>
        <div class="panel form grid2"><h2 class="h3 span2">Cours de secours</h2><p class="span2 tiny">Seulement si la source automatique tombe en panne longtemps. Laisser vide en temps normal (€ par once).</p>
          <label>Or<input type="number" step="0.01" name="fbOr" value="${st.fallbackSpot?.or ?? ''}"></label><label>Argent<input type="number" step="0.01" name="fbArgent" value="${st.fallbackSpot?.argent ?? ''}"></label>
          <label>Platine<input type="number" step="0.01" name="fbPlatine" value="${st.fallbackSpot?.platine ?? ''}"></label></div>
        <button class="btn btn-gold btn-lg" type="submit">Enregistrer les réglages</button></form>`;
    }
    return '';
  };

  const TITLES = { '': ['Tableau de bord', 'Tout ce qui se passe sur Maurice Or, en direct.'], valider: ['À valider', 'Deuxième confirmation des achats de vos clients.'] };
  const paint = () => {
    const [t, sub] = TITLES[tab] || [NAV.find((n) => n[0] === tab)[1], ''];
    view.innerHTML = adminShell(tab, d, body(), t, sub);
    paintIcons(view);
    document.title = d.stats.toApprove ? `(${d.stats.toApprove}) À valider – Maurice Or` : 'Administration – Maurice Or';
  };

  function orderActions(o) {
    const b = (st, label, cls = 'btn-light') => `<button class="btn ${cls} btn-sm" data-ord="${esc(o.ref)}" data-st="${st}">${label}</button> `;
    if (o.status === 'a_valider') return b('valider', 'Valider', 'btn-green') + b('refuser', 'Refuser', 'btn-red');
    if (o.status === 'en_attente_paiement') return b('payee', 'Paiement reçu', 'btn-green') + b('annulee', 'Annuler', 'btn-red');
    if (o.status === 'preparation') return (o.delivery === 'domicile' ? b('expediee', 'Expédiée', 'btn-green') : b('prete_retrait', 'Prête en boutique', 'btn-green')) + b('annulee', 'Annuler', 'btn-red');
    if (o.status === 'expediee' || o.status === 'prete_retrait') return b('livree', o.delivery === 'boutique' ? 'Retirée' : 'Livrée', 'btn-green');
    if (o.status === 'au_coffre') return b('annulee', 'Annuler', 'btn-red');
    return '';
  }

  async function reload() { d = await get('/api/admin/overview'); paint(); }

  view.addEventListener('click', (e) => handleAdminClick(e, reload));
  view.addEventListener('click', (e) => {
    const f = e.target.closest('[data-evf]');
    if (f) { evFilter = f.dataset.evf; paint(); }
    const sp = e.target.closest('[data-save-p]');
    if (sp) {
      const row = sp.closest('tr');
      const b = { premium: Number($('[name=premium]', row).value) / 100, stock: parseInt($('[name=stock]', row).value, 10), offer: $('[name=offer]', row).checked, active: $('[name=active]', row).checked };
      busy(sp, async () => { try { await put(`/api/admin/products/${row.dataset.pid}`, b); await loadProducts(); toast('Produit enregistré.'); await reload(); } catch (err) { toast(err.message, 'err'); } });
    }
  });
  view.addEventListener('input', (e) => {
    if (e.target.id === 'ev-search' || e.target.id === 'cl-search') {
      search = e.target.value.trim().toLowerCase();
      const pos = e.target.selectionStart;
      paint();
      const inp = $('#' + e.target.id, view); inp.focus(); inp.setSelectionRange(pos, pos);
    }
  });
  view.addEventListener('submit', async (e) => {
    if (e.target.id !== 'settings') return;
    e.preventDefault();
    const f = formData(e.target);
    const b = { ...f };
    for (const k of ['gramBuySpread', 'gramSellSpread', 'buybackSpread', 'maxPriceMove']) b[k] = Number(f[k]) / 100;
    b.shippingFee = Math.round(Number(f.shippingFee) * 100);
    b.freeShippingFrom = Math.round(Number(f.freeShippingFrom) * 100);
    b.fallbackSpot = f.fbOr && f.fbArgent && f.fbPlatine ? { or: f.fbOr, argent: f.fbArgent, platine: f.fbPlatine } : null;
    delete b.fbOr; delete b.fbArgent; delete b.fbPlatine;
    await busy($('button[type=submit]', e.target), async () => {
      try { await put('/api/admin/settings', b); await loadConfig(); toast('Réglages enregistrés.'); await reload(); }
      catch (err) { toast(err.message, 'err'); }
    });
  });

  paint();
  return livePolling(view, async () => {
    const before = d.stats.toApprove;
    d = await get('/api/admin/overview');
    if (d.stats.toApprove > before) toast('Nouvelle demande à valider.', 'info');
    return true;
  }, paint);
}

// Rafraîchissement automatique (sans gêner une saisie en cours) + comptes à rebours.
function livePolling(view, fetchFn, paint) {
  const tick = setInterval(() => { $$('[data-until]', view).forEach((el) => { el.textContent = countdown(el.dataset.until); }); }, 1000);
  const poll = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      await fetchFn();
      const typing = $('.modal-back') || (document.activeElement && view.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName));
      if (!typing) paint();
    } catch { /* réseau */ }
  }, 12000);
  return () => { clearInterval(tick); clearInterval(poll); document.title = 'Maurice Or – Achat et vente d\'or au cours du jour'; };
}

// Actions communes au tableau de bord et à la fiche client.
async function handleAdminClick(e, reload) {
  const t = e.target;
  if (t.closest('[data-logout]')) { await post('/api/auth/logout'); await loadMe(); go('#/'); return; }
  const act = (btn, fn, msg) => busy(btn, async () => { try { await fn(); toast(msg); await loadProducts().catch(() => {}); await reload(); } catch (err) { toast(err.message, 'err'); await reload(); } });
  const req = t.closest('[data-req]');
  if (req) {
    let note = '';
    if (req.dataset.a === 'refuse') { note = prompt('Motif du refus (envoyé au client, facultatif) :'); if (note === null) return; }
    return act(req, () => post(`/api/admin/requests/${req.dataset.req}/${req.dataset.a}`, { note }), req.dataset.a === 'approve' ? 'Demande validée : le client est prévenu.' : 'Demande refusée : les fonds sont rendus.');
  }
  const ord = t.closest('[data-ord]');
  if (ord) {
    const st = ord.dataset.st;
    let tracking, note;
    if (st === 'refuser') { note = prompt('Motif du refus (envoyé au client, facultatif) :'); if (note === null) return; }
    if (st === 'annulee' && !confirm('Annuler cette commande ? Le stock est remis et un paiement par solde ou carte est recrédité au client.')) return;
    if (st === 'expediee') tracking = prompt('Numéro de suivi du colis (facultatif) :') || '';
    return act(ord, () => post(`/api/admin/orders/${encodeURIComponent(ord.dataset.ord)}/status`, { status: st, tracking, note }), 'Commande mise à jour : le client est prévenu.');
  }
  const dep = t.closest('[data-dep]');
  if (dep) {
    if (dep.dataset.a === 'validate' && !confirm('Confirmez-vous avoir reçu ce virement sur le compte bancaire ?')) return;
    return act(dep, () => post(`/api/admin/deposits/${dep.dataset.dep}/${dep.dataset.a}`), 'Versement traité.');
  }
  const wd = t.closest('[data-wd]');
  if (wd) {
    if (wd.dataset.a === 'done' && !confirm('Confirmez-vous avoir envoyé le virement ?')) return;
    return act(wd, () => post(`/api/admin/withdrawals/${wd.dataset.wd}/${wd.dataset.a}`), 'Retrait traité.');
  }
  const msg = t.closest('[data-msg]');
  if (msg) return act(msg, () => post(`/api/admin/messages/${msg.dataset.msg}/handled`), 'Message traité.');
}

// ================= FICHE CLIENT =================
export async function clientPage(view, { id }) {
  if (!S.me || S.me.role !== 'admin') { go('#/connexion?next=/admin'); return; }
  let c = await get(`/api/admin/users/${encodeURIComponent(id)}`);
  let d = null;
  try { d = await get('/api/admin/overview'); } catch { /* compteurs facultatifs */ }
  const paint = () => {
    const u = c.user;
    const pendingReq = c.requests.filter((r) => r.status === 'en_attente');
    const content = `<div class="client-head"><span class="avatar">${esc(u.firstName[0] + u.lastName[0])}</span>
        <div><h1>${esc(u.firstName)} ${esc(u.lastName)}</h1><p class="muted" style="margin:0"><span class="online-dot ${u.online ? 'on' : ''}"></span>${u.online ? 'En ligne' : `Vu ${ago(u.lastSeen)}`} · ${esc(u.clientNo)} · client depuis le ${new Date(u.createdAt).toLocaleDateString('fr-FR')}</p></div>
        <div class="acts">${waClient(u.phone, u.firstName, '')}<a class="btn btn-light btn-sm" href="tel:${esc(u.phone)}">${ICON.phone}Appeler</a><a class="btn btn-light btn-sm" href="mailto:${esc(u.email)}">${ICON.mail}E-mail</a></div></div>
      <div class="kpis">
        <div class="kpi hot"><span>Valeur totale</span><b>${eur(c.total)}</b></div>
        <div class="kpi"><span>Solde disponible</span><b>${eur(c.cash)}</b><small>${c.held ? `${eur(c.held)} réservés` : ''}</small></div>
        <div class="kpi"><span>Or au gramme</span><b>${g(c.goldMg + c.heldMg)}</b><small>${eur(c.goldValue)}</small></div>
        <div class="kpi"><span>Coffre</span><b>${c.vault.reduce((a, x) => a + x.qty, 0)} produit(s)</b><small>${eur(c.vaultValue)}</small></div>
        <div class="kpi"><span>Panier en cours</span><b>${eur(c.cartValue)}</b><small>${c.cart.map((l) => `${l.qty} × ${esc(l.name)}`).join(', ') || 'vide'}</small></div>
      </div>
      ${pendingReq.length ? `<div class="panel-head"><h2>Demandes à valider</h2></div>${pendingReq.map((r) => `<div class="approve"><div><h3>${esc(REQUEST_KIND[r.kind])} · ${eur(r.amount)}</h3><div class="meta"><span>${esc(r.label)}</span><span>Expire dans <b class="timer" data-until="${r.expiresAt}">${countdown(r.expiresAt)}</b></span></div></div>
        <div class="acts"><button class="btn btn-red btn-sm" data-req="${r.id}" data-a="refuse">Refuser</button><button class="btn btn-green" data-req="${r.id}" data-a="approve">${ICON.check}Valider</button></div></div>`).join('')}` : ''}
      <div class="dash-grid">
        <div class="panel"><div class="panel-head"><h2>Tout ce qu'il a fait</h2><span class="tiny">${c.events.length} événements</span></div>${feed(c.events.slice(0, 150), { withClient: false })}</div>
        <div>
          <div class="panel"><div class="panel-head"><h2>Coordonnées</h2></div><dl class="kv">
            <dt>E-mail</dt><dd>${esc(u.email)}</dd><dt>Téléphone</dt><dd>${esc(u.phone)}</dd><dt>Adresse</dt><dd>${esc(u.address)}, ${esc(u.zip)} ${esc(u.city)}</dd>
            <dt>Naissance</dt><dd>${esc(u.birthdate || '')}</dd><dt>Sécurité</dt><dd>${u.totpEnabled ? 'Code activé' : 'Mot de passe seul'}</dd><dt>Dernière connexion</dt><dd>${u.lastLogin ? date(u.lastLogin) : '—'}</dd></dl></div>
          <div class="panel"><div class="panel-head"><h2>Coffre</h2></div>${c.vault.length ? `<ul class="ops">${c.vault.map((x) => `<li class="op"><span class="op-ico gold">${ICON.bar}</span><span class="op-label">${esc(x.product.name)}<small>× ${x.qty}</small></span><span class="op-amt">${eur(x.value)}</span></li>`).join('')}</ul>` : '<p class="muted small">Vide.</p>'}</div>
          <div class="panel"><div class="panel-head"><h2>Commandes</h2></div>${c.orders.length ? `<ul class="ops">${c.orders.slice(0, 10).map((o) => `<li class="op"><span class="op-ico">${ICON.bag}</span><span class="op-label"><a href="#/commande/${esc(o.ref)}">${esc(o.ref)}</a><small>${esc(ORDER_STATUS[o.status])} · ${date(o.createdAt)}</small></span><span class="op-amt">${eur(o.total)}</span></li>`).join('')}</ul>` : '<p class="muted small">Aucune.</p>'}</div>
          <div class="panel"><div class="panel-head"><h2>Mouvements</h2></div>${c.ledger.length ? `<ul class="ops">${c.ledger.slice(0, 12).map((l) => `<li class="op"><span class="op-ico ${l.amount > 0 ? 'in' : 'gold'}">${l.amount > 0 ? ICON.in : ICON.coins}</span><span class="op-label">${esc(l.label)}<small>${date(l.at)}</small></span><span class="op-amt ${l.amount > 0 ? 'pos' : ''}">${l.amount ? eur(l.amount) : ''}</span></li>`).join('')}</ul>` : '<p class="muted small">Aucun.</p>'}</div>
          ${c.messages.length ? `<div class="panel"><div class="panel-head"><h2>Messages</h2></div>${c.messages.map((m) => `<p class="small"><b>${esc(m.subject)}</b> · ${date(m.createdAt)}<br>${esc(m.message)}</p>`).join('')}</div>` : ''}
        </div>
      </div>`;
    view.innerHTML = adminShell('clients', d, content, 'Fiche client');
    paintIcons(view);
  };
  const reload = async () => { c = await get(`/api/admin/users/${encodeURIComponent(id)}`); paint(); };
  view.addEventListener('click', (e) => handleAdminClick(e, reload));
  paint();
  return livePolling(view, async () => { c = await get(`/api/admin/users/${encodeURIComponent(id)}`); }, paint);
}
