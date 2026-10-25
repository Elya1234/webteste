// Espace administrateur : commandes, versements, retraits, produits (primes, stock),
// clients, messages et réglages de la boutique.
import { S, loadProducts, loadConfig } from './store.js';
import { get, post, put } from './api.js';
import { $, esc, eur, num2, toast, busy, formData, date, gramsNum } from './ui.js';
import { go } from './app.js';
import { ORDER_STATUS } from './shared/core.js';

const TABS = [['tableau', 'Tableau de bord'], ['commandes', 'Commandes'], ['versements', 'Versements'], ['retraits', 'Retraits'], ['produits', 'Produits & prix'], ['clients', 'Clients'], ['messages', 'Messages'], ['reglages', 'Réglages']];
const DELIV = { domicile: 'Domicile', boutique: 'Boutique', coffre: 'Coffre' };
const PAY = { solde: 'Solde', carte: 'Carte', virement: 'Virement' };

export async function adminPage(view, { tab = 'tableau' }) {
  if (!S.me) { go('#/connexion?next=/admin'); return; }
  if (S.me.role !== 'admin') { view.innerHTML = '<div class="page"><h1 class="title">Accès réservé</h1></div>'; return; }
  let d = await get('/api/admin/overview');

  const paint = () => {
    view.innerHTML = `<div class="page page-wide admin">
      <h1 class="title">Administration</h1>
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<a role="tab" href="#/admin/${k}" aria-selected="${k === tab}">${l}${badge(k)}</a>`).join('')}</div>
      <div class="tab-body">${body()}</div>
    </div>`;
  };
  const badge = (k) => {
    const n = { commandes: d.stats.ordersToHandle, versements: d.deposits.filter((x) => x.status === 'en_attente').length, retraits: d.withdrawals.filter((x) => x.status === 'en_attente').length, messages: d.messages.filter((m) => !m.handled).length }[k];
    return n ? ` <span class="count">${n}</span>` : '';
  };

  const body = () => {
    if (tab === 'tableau') {
      const vt = Object.entries(d.stats.vaultTotals);
      return `<div class="stats">
        <div><span>Clients</span><b>${d.stats.users}</b></div>
        <div><span>Or au gramme détenu par les clients</span><b>${gramsNum(d.stats.goldOwedMg / 1000)} g</b><small>à couvrir en stock physique</small></div>
        <div><span>Soldes clients (€)</span><b>${eur(d.stats.cashOwed)}</b><small>à garder sur le compte bancaire</small></div>
        <div><span>Commandes à traiter</span><b>${d.stats.ordersToHandle}</b></div>
      </div>
      <h3>Produits gardés au coffre pour les clients</h3>
      ${vt.length ? `<table class="ptable"><thead><tr><th>Produit</th><th>Quantité</th></tr></thead><tbody>${vt.map(([id, q]) => `<tr><td>${esc(S.byId[id]?.name || id)}</td><td>${q}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aucun.</p>'}`;
    }
    if (tab === 'commandes') {
      return `<div class="ptable-wrap"><table class="ptable admin-table"><thead><tr><th>Réf.</th><th>Date</th><th>Client</th><th>Articles</th><th>Total</th><th>Mode</th><th>Statut</th><th>Action</th></tr></thead><tbody>
        ${d.orders.map((o) => `<tr><td><a href="#/commande/${esc(o.ref)}">${esc(o.ref)}</a>${o.kind === 'coffre' ? '<br><small>sortie coffre</small>' : ''}</td><td>${date(o.createdAt)}</td><td>${esc(o.client)}</td>
          <td>${o.items.map((i) => `${i.qty} × ${esc(i.name)}`).join('<br>')}</td><td>${eur(o.total)}</td><td>${DELIV[o.delivery]}<br><small>${PAY[o.payment]}</small>
          ${o.address ? `<br><small>${esc(o.address.name)}, ${esc(o.address.address)}, ${esc(o.address.zip)} ${esc(o.address.city)} ${esc(o.address.phone || '')}</small>` : ''}</td>
          <td><span class="tag tag-${o.status}">${esc(ORDER_STATUS[o.status])}</span>${o.tracking ? `<br><small>${esc(o.tracking)}</small>` : ''}</td>
          <td>${orderActions(o)}</td></tr>`).join('') || '<tr><td colspan="8">Aucune commande.</td></tr>'}
      </tbody></table></div>`;
    }
    if (tab === 'versements') {
      return table(['Réf.', 'Date', 'Client', 'Mode', 'Montant', 'Statut', ''], d.deposits.map((x) => [esc(x.ref), date(x.createdAt), esc(x.client), x.method, eur(x.amount), x.status,
        x.status === 'en_attente' ? `<button class="btn-green" data-dep="${x.id}" data-a="validate">Reçu → créditer</button> <button class="btn-outline" data-dep="${x.id}" data-a="refuse">Refuser</button>` : '']));
    }
    if (tab === 'retraits') {
      return table(['Réf.', 'Date', 'Client', 'Titulaire', 'IBAN', 'Montant', 'Statut', ''], d.withdrawals.map((x) => [esc(x.ref), date(x.createdAt), esc(x.client), esc(x.holder), `<span class="mono">${esc(x.iban)}</span>`, eur(x.amount), x.status,
        x.status === 'en_attente' ? `<button class="btn-green" data-wd="${x.id}" data-a="done">Virement fait</button> <button class="btn-outline" data-wd="${x.id}" data-a="refuse">Refuser (recréditer)</button>` : '']));
    }
    if (tab === 'produits') {
      return `<p class="tiny">Prime = marge ajoutée au cours du métal. Exemple : 6 → prix = valeur du métal + 6 %. « Offre 0 % » vend au prix du métal.</p>
      <div class="ptable-wrap"><table class="ptable admin-table"><thead><tr><th>Produit</th><th>Valeur métal</th><th>Prix actuel</th><th>Prime %</th><th>Stock</th><th>Offre 0 %</th><th>Visible</th><th></th></tr></thead><tbody>
        ${d.products.map((p) => `<tr data-pid="${p.id}"><td>${esc(p.name)}</td><td>${p.metalValue ? eur(p.metalValue) : '…'}</td><td>${p.price ? eur(p.price) : '…'}</td>
          <td><input type="number" step="0.1" name="premium" value="${num2(p.premium * 100).replace(',', '.').replace(/\.00$/, '')}" class="in-sm"></td>
          <td><input type="number" step="1" min="0" name="stock" value="${p.stock}" class="in-sm"></td>
          <td><input type="checkbox" name="offer"${p.offer ? ' checked' : ''}></td><td><input type="checkbox" name="active"${p.active ? ' checked' : ''}></td>
          <td><button class="btn-dark btn-sm" data-save-p>Enregistrer</button></td></tr>`).join('')}
      </tbody></table></div>`;
    }
    if (tab === 'clients') {
      return table(['N° client', 'Nom', 'E-mail', 'Téléphone', 'Ville', 'Solde', 'Or (g)', '2FA', 'Inscrit le'], d.users.map((u) => [u.clientNo, esc(u.name) + (u.role === 'admin' ? ' <small>(admin)</small>' : ''), esc(u.email), esc(u.phone), esc(u.city), eur(u.cash), gramsNum(u.goldMg / 1000), u.totp ? '✔' : '—', date(u.createdAt)]));
    }
    if (tab === 'messages') {
      return d.messages.map((m) => `<div class="card msg${m.handled ? ' is-done' : ''}"><p><b>${esc(m.subject || 'Message')}</b> — ${esc(m.name)} · <a href="mailto:${esc(m.email)}">${esc(m.email)}</a> ${m.phone ? `· <a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ''} · ${date(m.createdAt)}</p>
        <p class="pre">${esc(m.message)}</p>${m.handled ? '<small>Traité</small>' : `<button class="btn-outline btn-sm" data-msg="${m.id}">Marquer comme traité</button>`}</div>`).join('') || '<p class="muted">Aucun message.</p>';
    }
    if (tab === 'reglages') {
      const s = d.settings;
      const pc = (v) => num2(v * 100).replace(',', '.');
      return `<form class="form card grid2" id="settings">
        <h3 class="span2">Marges</h3>
        <label>Achat au gramme : cours + (%)<input type="number" step="0.01" name="gramBuySpread" value="${pc(s.gramBuySpread)}"></label>
        <label>Vente au gramme : cours − (%)<input type="number" step="0.01" name="gramSellSpread" value="${pc(s.gramSellSpread)}"></label>
        <label>Rachat produits du coffre : métal − (%)<input type="number" step="0.01" name="buybackSpread" value="${pc(s.buybackSpread)}"></label>
        <label>Écart de cours toléré à la validation (%)<input type="number" step="0.01" name="maxPriceMove" value="${pc(s.maxPriceMove)}"></label>
        <label>Minimum par opération au gramme (g)<input type="number" step="0.01" name="minGramTrade" value="${s.minGramTrade}"></label>
        <label>Bloquer les transactions si le cours a plus de (minutes)<input type="number" name="staleAfterMin" value="${s.staleAfterMin}"></label>
        <h3 class="span2">Livraison</h3>
        <label>Frais de livraison assurée (€)<input type="number" step="0.01" name="shippingFee" value="${s.shippingFee / 100}"></label>
        <label>Livraison offerte dès (€)<input type="number" step="1" name="freeShippingFrom" value="${s.freeShippingFrom / 100}"></label>
        <h3 class="span2">Boutique</h3>
        <label>Nom<input name="shopName" value="${esc(s.shopName)}"></label><label>Téléphone<input name="shopPhone" value="${esc(s.shopPhone)}"></label>
        <label class="span2">Adresse<input name="shopAddress" value="${esc(s.shopAddress)}"></label>
        <label>Horaires<input name="shopHours" value="${esc(s.shopHours)}"></label><label>E-mail<input name="shopEmail" value="${esc(s.shopEmail)}"></label>
        <h3 class="span2">Coordonnées bancaires (pour les virements)</h3>
        <label>Titulaire<input name="bankHolder" value="${esc(s.bankHolder)}"></label><label>BIC<input name="bankBic" value="${esc(s.bankBic)}"></label>
        <label class="span2">IBAN<input name="bankIban" value="${esc(s.bankIban)}"></label>
        <h3 class="span2">Cours de secours</h3>
        <p class="span2 tiny">À utiliser seulement si la source automatique tombe en panne longtemps. Laisser vide en temps normal. En € par once.</p>
        <label>Or<input type="number" step="0.01" name="fbOr" value="${s.fallbackSpot?.or ?? ''}"></label><label>Argent<input type="number" step="0.01" name="fbArgent" value="${s.fallbackSpot?.argent ?? ''}"></label>
        <label>Platine<input type="number" step="0.01" name="fbPlatine" value="${s.fallbackSpot?.platine ?? ''}"></label>
        <button class="btn-buy span2" type="submit">Enregistrer les réglages</button></form>`;
    }
    return '';
  };

  const table = (head, rows) => `<div class="ptable-wrap"><table class="ptable admin-table"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${head.length}">Rien pour le moment.</td></tr>`}</tbody></table></div>`;

  function orderActions(o) {
    const b = (st, label, cls = 'btn-outline') => `<button class="${cls} btn-sm" data-ord="${esc(o.ref)}" data-st="${st}">${label}</button>`;
    if (o.status === 'en_attente_paiement') return b('payee', 'Paiement reçu', 'btn-green') + b('annulee', 'Annuler');
    if (o.status === 'preparation') return (o.delivery === 'domicile' ? b('expediee', 'Expédiée', 'btn-green') : b('prete_retrait', 'Prête en boutique', 'btn-green')) + b('annulee', 'Annuler');
    if (o.status === 'expediee' || o.status === 'prete_retrait') return b('livree', o.delivery === 'boutique' ? 'Retirée' : 'Livrée', 'btn-green');
    if (o.status === 'au_coffre') return b('annulee', 'Annuler');
    return '';
  }

  async function reload() { d = await get('/api/admin/overview'); paint(); }

  view.addEventListener('click', async (e) => {
    const t = e.target;
    const act = async (btn, fn, msg) => busy(btn, async () => { try { await fn(); toast(msg); await reload(); } catch (err) { toast(err.message, 'err'); } });
    const ord = t.closest('[data-ord]');
    if (ord) {
      const st = ord.dataset.st;
      let tracking;
      if (st === 'annulee' && !confirm('Annuler cette commande ? Le stock sera remis et un paiement par solde/carte sera recrédité sur le solde du client.')) return;
      if (st === 'expediee') tracking = prompt('Numéro de suivi du colis (facultatif) :') || '';
      return act(ord, () => post(`/api/admin/orders/${encodeURIComponent(ord.dataset.ord)}/status`, { status: st, tracking }), 'Commande mise à jour.');
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
    const sp = t.closest('[data-save-p]');
    if (sp) {
      const row = sp.closest('tr');
      const body = {
        premium: Number($('[name=premium]', row).value) / 100,
        stock: parseInt($('[name=stock]', row).value, 10),
        offer: $('[name=offer]', row).checked,
        active: $('[name=active]', row).checked,
      };
      return act(sp, async () => { await put(`/api/admin/products/${row.dataset.pid}`, body); await loadProducts(); }, 'Produit enregistré.');
    }
  });

  view.addEventListener('submit', async (e) => {
    if (e.target.id !== 'settings') return;
    e.preventDefault();
    const f = formData(e.target);
    const body = { ...f };
    for (const k of ['gramBuySpread', 'gramSellSpread', 'buybackSpread', 'maxPriceMove']) body[k] = Number(f[k]) / 100;
    body.shippingFee = Math.round(Number(f.shippingFee) * 100);
    body.freeShippingFrom = Math.round(Number(f.freeShippingFrom) * 100);
    body.fallbackSpot = f.fbOr && f.fbArgent && f.fbPlatine ? { or: f.fbOr, argent: f.fbArgent, platine: f.fbPlatine } : null;
    delete body.fbOr; delete body.fbArgent; delete body.fbPlatine;
    await busy($('button[type=submit]', e.target), async () => {
      try { await put('/api/admin/settings', body); await loadConfig(); toast('Réglages enregistrés.'); await reload(); }
      catch (err) { toast(err.message, 'err'); }
    });
  });

  paint();
}
