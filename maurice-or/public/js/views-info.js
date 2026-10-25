// Contact et pages d'information (FAQ, livraison, paiement, guide, vendre son or…).
import { S } from './store.js';
import { post } from './api.js';
import { $, esc, eur, num2, toast, busy, formData, gramsNum } from './ui.js';
import { METAL_LABEL } from './shared/catalog.js';
import { DEFAULT_SETTINGS } from './shared/pricing.js';

export async function contact(view, _p, query) {
  const c = S.config || DEFAULT_SETTINGS;
  const rdv = query.sujet === 'rdv';
  view.innerHTML = `<div class="page">
    <h1 class="title">${rdv ? 'Prendre rendez-vous' : 'Contact'}</h1>
    <div class="two-cols">
      <form class="form card" id="contact">
        <label>Nom<input name="name" required autocomplete="name" value="${esc(S.me ? `${S.me.firstName} ${S.me.lastName}` : '')}"></label>
        <label>E-mail<input type="email" name="email" required autocomplete="email" value="${esc(S.me?.email || '')}"></label>
        <label>Téléphone<input type="tel" name="phone" autocomplete="tel" value="${esc(S.me?.phone || '')}"></label>
        <label>Sujet<select name="subject">
          ${['Question sur un produit', 'Rendez-vous en boutique', 'Vendre mon or', 'Suivi de commande', 'Mon compte', 'Autre'].map((s) => `<option${(rdv && s.startsWith('Rendez')) ? ' selected' : ''}>${s}</option>`).join('')}
        </select></label>
        <label>Message<textarea name="message" rows="6" required placeholder="${rdv ? 'Indiquez vos disponibilités et ce que vous souhaitez faire (achat, vente, retrait de commande)…' : 'Votre message…'}"></textarea></label>
        <button class="btn-buy" type="submit">Envoyer</button>
      </form>
      <div class="card">
        <h2>${esc(c.shopName)}</h2>
        <p><b>Boutique :</b><br>${esc(c.shopAddress)}</p>
        <p><b>Horaires :</b><br>${esc(c.shopHours)}</p>
        <p><b>Téléphone :</b><br><a href="tel:${esc(c.shopPhone.replace(/\s/g, ''))}">${esc(c.shopPhone)}</a></p>
        <p><b>E-mail :</b><br><a href="mailto:${esc(c.shopEmail)}">${esc(c.shopEmail)}</a></p>
        <p class="tiny">Pour un retrait de commande ou une vente d'or en boutique, munissez-vous d'une pièce d'identité en cours de validité.</p>
      </div>
    </div>
  </div>`;
  $('#contact', view).addEventListener('submit', async (e) => {
    e.preventDefault();
    await busy($('button', e.target), async () => {
      try {
        await post('/api/contact', formData(e.target));
        e.target.reset();
        toast('Message envoyé. Nous vous répondons rapidement.');
      } catch (err) { toast(err.message, 'err'); }
    });
  });
}

const cfg = () => S.config || DEFAULT_SETTINGS;

const PAGES = {
  'qui-sommes-nous': () => ['Qui sommes-nous ?', `
    <p><b>${esc(cfg().shopName)}</b> vous permet d'acheter et de vendre de l'or physique simplement, au cours du jour, en ligne ou dans notre boutique.</p>
    <p>Nos prix suivent automatiquement le cours mondial de l'or, relevé en continu. Chaque prix est la valeur du métal contenu, plus une prime affichée en toute transparence sur chaque fiche produit.</p>
    <p>Avec le <b>compte poids or</b>, vous achetez de l'or au gramme près, vous le gardez en sécurité dans notre coffre et vous le revendez en un clic, ou vous vous le faites livrer quand vous le souhaitez.</p>`],
  boutique: () => ['Notre boutique', `
    <p><b>Adresse :</b> ${esc(cfg().shopAddress)}</p><p><b>Horaires :</b> ${esc(cfg().shopHours)}</p><p><b>Téléphone :</b> ${esc(cfg().shopPhone)}</p>
    <p>En boutique vous pouvez : retirer une commande passée en ligne, acheter des pièces et lingots, faire estimer et vendre votre or.</p>
    <p><a class="btn-dark" href="#/contact?sujet=rdv">Prendre rendez-vous</a></p>`],
  securite: () => ['La sécurité de votre compte', `
    <ul class="list">
      <li>Mots de passe chiffrés de façon irréversible (personne, même nous, ne peut les lire).</li>
      <li>Connexion protégée contre les tentatives répétées : le compte se verrouille 15 minutes après 5 erreurs.</li>
      <li>Double authentification (code à 6 chiffres sur votre téléphone) disponible pour la connexion et les retraits.</li>
      <li>Session fermée automatiquement après 4 h d'inactivité ; échanges chiffrés (HTTPS).</li>
      <li>Chaque achat ou vente reprend le cours au moment exact de la validation : impossible d'acheter à un prix périmé.</li>
      <li>Les retraits ne partent que vers un compte bancaire, après confirmation par mot de passe.</li>
    </ul>`],
  faq: () => ['Foire aux questions', faq([
    ['Comment sont calculés les prix ?', 'Prix = valeur du métal fin contenu (au cours en direct) + une prime qui couvre la fabrication, l\'assurance et le transport. La prime baisse avec la quantité commandée (dès 2, 5 et 10 pièces).'],
    ['À quelle fréquence le cours est-il mis à jour ?', 'Automatiquement, toutes les deux minutes environ. Les prix affichés sur le site se rafraîchissent tout seuls.'],
    ['Qu\'est-ce que le compte poids or ?', 'Un compte où vous détenez de l\'or au gramme près (dès 0,1 g). Vous achetez et revendez quand vous voulez au cours du moment, depuis votre téléphone.'],
    ['Mon or est-il vraiment à moi ?', 'Oui : l\'or que vous achetez est de l\'or physique. Vous pouvez à tout moment vous faire livrer les lingots et pièces de votre coffre, ou les retirer en boutique.'],
    ['Comment récupérer mon argent ?', 'Vendez votre or depuis votre compte : le montant est crédité immédiatement sur votre solde, que vous pouvez virer sur votre compte bancaire.'],
    ['Y a-t-il de la TVA ?', 'Non sur l\'or d\'investissement (lingots et pièces d\'or). L\'argent et le platine sont soumis à la TVA sur marge, déjà incluse dans le prix affiché.'],
    ['Quels sont les délais de livraison ?', 'Expédition sous 2 à 5 jours ouvrés après paiement, en envoi assuré et remis contre signature.'],
  ])],
  paiement: () => ['Méthodes de paiement', `
    <ul class="list"><li><b>Solde de votre compte</b> : immédiat.</li><li><b>Carte bancaire</b> (CB, Visa, Mastercard, Apple Pay) via un prestataire certifié, avec 3D Secure.</li>
    <li><b>Virement bancaire</b> : votre prix est bloqué à la commande ; nous préparons votre commande à réception des fonds.</li></ul>`],
  livraison: () => ['Livraison', `
    <ul class="list"><li><b>Livraison assurée à domicile</b> : ${eur(cfg().shippingFee)}, offerte dès ${eur(cfg().freeShippingFrom)}. Colis discret, assuré à 100 %, remis contre signature.</li>
    <li><b>Retrait en boutique</b> : gratuit, avec une pièce d'identité.</li>
    <li><b>Garde au coffre</b> : gratuit. Vos produits restent stockés en sécurité et revendables en un clic.</li></ul>`],
  retour: () => ['Politique de retour', `
    <p>Le prix des métaux précieux dépend des fluctuations du marché financier. Conformément à l'article L221-28 du Code de la consommation, <b>le droit de rétractation ne s'applique pas</b> à ces produits.</p>
    <p>En revanche, vous pouvez à tout moment nous revendre vos produits au prix de rachat du jour, depuis votre compte ou en boutique. Tout colis endommagé doit être refusé et signalé sous 48 h.</p>`],
  'comment-acheter': () => ['Comment acheter', `<ol class="steps">
    <li><b>Choisissez</b> vos pièces ou lingots : le prix suit le cours en direct.</li>
    <li><b>Ajoutez au panier</b> et choisissez : livraison à domicile, retrait en boutique ou garde au coffre.</li>
    <li><b>Payez</b> avec votre solde, par carte ou par virement.</li>
    <li><b>Suivez</b> votre commande depuis votre compte.</li></ol>`],
  guide: () => ['Investir dans l\'or : le guide', `
    <h3>Pièces ou lingots ?</h3><p>Les <b>lingots</b> ont la prime la plus faible pour les gros montants. Les <b>pièces</b> (Napoléon, Krugerrand, Souverain…) sont plus faciles à revendre par petites quantités.</p>
    <h3>L'or au gramme</h3><p>Idéal pour investir progressivement, même avec de petits montants, et revendre exactement la quantité voulue.</p>
    <h3>Diversifier</h3><p>L'or est souvent utilisé comme valeur refuge, sur le long terme et pour une partie seulement de son épargne. Son cours peut baisser comme monter.</p>`],
  vendre: () => ['Vendre de l\'or et de l\'argent', `
    <p><b>Votre or est sur votre compte ?</b> Vendez-le en un clic depuis <a href="#/compte">Mon compte</a> : l'argent est crédité immédiatement.</p>
    <p><b>Vous avez des bijoux, pièces ou lingots chez vous ?</b> Venez en boutique pour une estimation gratuite. Estimation indicative ci-dessous :</p>
    <form class="form card grid2" id="estim"><label>Poids (grammes)<input type="number" step="0.01" min="0" name="w" value="10"></label>
      <label>Titre<select name="t"><option value="999.9">Or 24 carats / lingot (999,9)</option><option value="916.7">Or 22 carats (916)</option><option value="900">Pièce d'or (900)</option><option value="750" selected>Or 18 carats (750)</option><option value="585">Or 14 carats (585)</option><option value="375">Or 9 carats (375)</option></select></label>
      <p class="span2">Estimation : <b id="estim-out" class="big">…</b></p><p class="span2 tiny">Valeur du métal fin au cours actuel, moins ${num2(cfg().buybackSpread * 100)} %. Le prix définitif est confirmé après contrôle en boutique.</p></form>
    <p><a class="btn-dark" href="#/contact?sujet=rdv">Prendre rendez-vous pour vendre</a></p>`, (root) => {
      const f = $('#estim', root);
      const calc = () => {
        const g = S.prices?.gram?.eur?.or;
        $('#estim-out', root).textContent = g ? eur(Math.round(Number(f.w.value) * Number(f.t.value) / 1000 * g * (1 - cfg().buybackSpread) * 100)) : 'cours en attente';
      };
      f.addEventListener('input', calc); calc();
    }],
  calculateur: () => ['Calculateur d\'investissement', `
    <form class="form card" id="calc"><label>Mon budget (€)<input type="number" name="b" min="0" step="50" value="2000"></label></form>
    <div id="calc-out"></div>`, (root) => {
      const f = $('#calc', root);
      const calc = () => {
        const b = Math.max(0, Number(f.b.value) || 0) * 100;
        const p = S.prices;
        const gramLine = p?.available ? `<tr><td>Or au gramme (compte poids or)</td><td>${eur(p.gramBuy)}/g</td><td><b>${gramsNum(Math.floor(b * 1000 / p.gramBuy) / 1000)} g</b></td></tr>` : '';
        const rows = S.products.filter((x) => x.metal === 'or' && x.price && x.price <= b).sort((a, c) => a.price / a.fine - c.price / c.fine).slice(0, 10)
          .map((x) => `<tr><td><a href="#/produit/${x.id}">${esc(x.name)}</a></td><td>${eur(x.price)}</td><td><b>${Math.floor(b / x.price)}</b> (${gramsNum(Math.floor(b / x.price) * x.fine)} g d'or)</td></tr>`).join('');
        $('#calc-out', root).innerHTML = `<table class="ptable"><thead><tr><th>Produit</th><th>Prix</th><th>Avec ce budget</th></tr></thead><tbody>${gramLine}${rows || '<tr><td colspan="3">Augmentez le budget pour voir les produits.</td></tr>'}</tbody></table>
          <p class="tiny">Classés du moins cher au gramme d'or au plus cher.</p>`;
      };
      f.addEventListener('input', calc); calc();
    }],
  index: () => {
    const p = S.prices;
    return ['Index des métaux précieux', p?.available ? `<table class="rates rates-wide"><thead><tr><th>Métal</th><th>1 gramme</th><th>1 once (31,1 g)</th><th>1 kilo</th></tr></thead><tbody>
      ${['or', 'argent', 'platine'].map((m) => `<tr><th>${METAL_LABEL[m]}</th><td>${num2(p.gram.eur[m])} €</td><td>${num2(p.oz[m])} €</td><td>${num2(p.gram.eur[m] * 1000)} €</td></tr>`).join('')}</tbody></table>
      <p class="tiny">Cours de référence, mis à jour automatiquement. <a href="#/cours">Voir le graphique</a></p>` : '<p>Cours en attente…</p>'];
  },
  mentions: () => ['Mentions légales', `
    <p><b>Éditeur :</b> ${esc(cfg().shopName)} — [forme juridique, capital, RCS, SIRET, n° TVA à compléter]</p>
    <p><b>Adresse :</b> ${esc(cfg().shopAddress)} · <b>Contact :</b> ${esc(cfg().shopEmail)}</p>
    <p><b>Directeur de la publication :</b> [à compléter]</p><p><b>Hébergeur :</b> [à compléter]</p>`],
  cgv: () => ['Conditions générales de vente', `
    <p class="info-box">Modèle à faire valider par un professionnel du droit avant la mise en ligne.</p>
    <h3>1. Prix</h3><p>Les prix sont indiqués en euros et suivent le cours des métaux précieux en temps réel. Le prix applicable est celui affiché au moment de la validation de la commande.</p>
    <h3>2. Commande et paiement</h3><p>La commande est ferme dès sa validation. Pour un paiement par virement, le prix est bloqué ; à défaut de réception des fonds sous 3 jours ouvrés, la commande peut être annulée.</p>
    <h3>3. Livraison</h3><p>Les envois sont assurés et remis contre signature. Les produits peuvent aussi être retirés en boutique ou gardés au coffre.</p>
    <h3>4. Compte poids or</h3><p>L'or acheté au gramme est de l'or physique détenu pour le compte du client. Le client peut le revendre à tout moment au prix de rachat affiché.</p>
    <h3>5. Rétractation</h3><p>Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux biens dont le prix dépend des fluctuations du marché financier.</p>
    <h3>6. Lutte contre le blanchiment</h3><p>Des justificatifs d'identité et d'origine des fonds peuvent être demandés conformément à la réglementation.</p>`],
  confidentialite: () => ['Politique de confidentialité', `
    <p>Nous collectons uniquement les données nécessaires à la gestion de votre compte, de vos commandes et à nos obligations légales (identité, coordonnées, opérations).</p>
    <p>Vos données ne sont jamais vendues. Elles sont conservées pendant la durée légale. Vous pouvez demander leur consultation, rectification ou suppression à ${esc(cfg().shopEmail)}.</p>
    <p>Le site n'utilise qu'un cookie technique de session (connexion) et le stockage local du navigateur pour votre panier.</p>`],
};

function faq(items) {
  return items.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
}

export async function infoPage(view, { slug }) {
  const page = PAGES[slug];
  if (!page) { view.innerHTML = '<div class="page"><h1 class="title">Page introuvable</h1></div>'; return; }
  const [title, html, after] = page();
  view.innerHTML = `<div class="page prose"><h1 class="title">${title}</h1>${html}</div>`;
  if (after) after(view);
}
