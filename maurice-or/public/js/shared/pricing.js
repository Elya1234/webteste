// Calcul des prix : partagé entre le serveur et le navigateur pour que
// le prix affiché soit exactement celui facturé. Montants en centimes.
import { OZ } from './catalog.js';

export const DEFAULT_SETTINGS = {
  shopName: 'Maurice Or',
  gramBuySpread: 0.015,   // achat d'or au gramme : cours + 1,5 %
  gramSellSpread: 0.015,  // vente d'or au gramme : cours - 1,5 %
  buybackSpread: 0.03,    // rachat d'un produit gardé au coffre : valeur métal - 3 %
  shippingFee: 1500,      // livraison assurée à domicile (centimes)
  freeShippingFrom: 30000,
  minGramTrade: 0.1,      // quantité minimale échangée sur le compte poids or (g)
  maxPriceMove: 0.005,    // écart de cours toléré entre l'affichage et la validation
  staleAfterMin: 20,      // au-delà, on bloque les achats/ventes (cours trop ancien)
  shopAddress: '12 rue de la Paix, 75002 Paris',
  shopHours: 'Du lundi au samedi, 10h – 19h',
  shopPhone: '01 23 45 67 89',
  shopEmail: 'contact@maurice-or.fr',
  bankHolder: 'MAURICE OR SAS',
  bankIban: 'FR76 0000 0000 0000 0000 0000 000',
  bankBic: 'XXXXFRPPXXX',
  fallbackSpot: null,     // cours de secours manuel {or, argent, platine} en €/once
  whatsapp: '33612345678', // numéro WhatsApp de la boutique, format international sans + ni espaces
  approvalBuy: true,      // chaque achat doit être confirmé par l'administrateur
  approvalSell: false,    // idem pour les ventes (désactivé : le client revend tout de suite)
  approvalWindowMin: 30,  // délai de validation ; passé ce délai, la demande expire et les fonds sont rendus
};

// Remise sur la prime selon la quantité commandée (fraction de la prime retirée).
export const TIERS = [
  { min: 1, cut: 0 },
  { min: 2, cut: 0.15 },
  { min: 5, cut: 0.25 },
  { min: 10, cut: 0.35 },
];

export function perGram(spot, metal = 'or', cur = 'eur') {
  const oz = spot && spot[cur] && spot[cur][metal];
  return oz ? oz / OZ : 0;
}

export function premiumOf(p) {
  return p.offer ? 0 : p.premium;
}

function tierFor(qty) {
  let t = TIERS[0];
  for (const x of TIERS) if (qty >= x.min) t = x;
  return t;
}

export function metalValueCents(p, spot) {
  return Math.round(perGram(spot, p.metal) * p.fine * 100);
}

export function unitPriceCents(p, spot, qty = 1) {
  const prem = premiumOf(p);
  const eff = prem > 0 ? prem * (1 - tierFor(qty).cut) : prem;
  return Math.round(perGram(spot, p.metal) * p.fine * (1 + eff) * 100);
}

export function tierTable(p, spot) {
  return TIERS.map((t) => ({ min: t.min, unit: unitPriceCents(p, spot, t.min) }));
}

export function buybackCents(p, spot, s) {
  return Math.round(perGram(spot, p.metal) * p.fine * (1 - s.buybackSpread) * 100);
}

export function gramBuyCents(spot, s) {
  return Math.round(perGram(spot, 'or') * (1 + s.gramBuySpread) * 100);
}

export function gramSellCents(spot, s) {
  return Math.round(perGram(spot, 'or') * (1 - s.gramSellSpread) * 100);
}

export function shippingCents(subtotal, delivery, s) {
  if (delivery !== 'domicile') return 0;
  return subtotal >= s.freeShippingFrom ? 0 : s.shippingFee;
}

export function badgeOf(p) {
  if (!p.stock || p.stock <= 0) return { key: 'rupture', text: ['SUR COMMANDE'] };
  if (p.offer) return { key: 'offre', text: ['OFFRE DU JOUR', '0 % DE COMMISSION'] };
  if (p.premium < 0) return { key: 'sous', text: ['VENDU EN DESSOUS', 'DU PRIX DE COTATION'] };
  return { key: 'dispo', text: ['DISPONIBLE'] };
}

// --- Formatage ---
const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function eur(cents) {
  return nf.format((cents || 0) / 100) + ' €';
}
export function money(value, symbol) {
  return nf.format(value || 0) + ' ' + symbol;
}
export function grams(mg) {
  const g = (mg || 0) / 1000;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(g) + ' g';
}
