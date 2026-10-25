// Catalogue de départ. Les primes (premium) sont en fraction du cours :
// 0.06 = le prix de vente est le cours du métal fin + 6 %.
// Tout est modifiable ensuite depuis l'espace admin (prime, stock, offre, visibilité).

export const OZ = 31.1034768; // grammes dans une once troy

const FR = 'fr', CH = 'ch', TN = 'tn', DE = 'de', IT = 'it', AT = 'at', BE = 'be',
  GB = 'gb', ZA = 'za', MX = 'mx', CA = 'ca', AU = 'au';

function coin(id, name, weight, purity, country, premium, extra = {}) {
  return { id, name, category: 'piece', metal: 'or', weight, purity, country, premium, ...extra };
}
function bar(id, name, weight, purity, premium, extra = {}) {
  return { id, name, category: 'lingot', metal: 'or', weight, purity, premium, maker: 'Fondeur certifié LBMA (Heraeus, PAMP, Umicore, Metalor)', ...extra };
}

export const PRODUCTS = [
  // ---------- Lingots d'or ----------
  bar('lingot-or-1kg', 'Lingot Or 1 Kg', 1000, 999.9, 0.025, { featured: true }),
  bar('lingot-or-500g', 'Lingot Or 500 G', 500, 999.9, 0.027),
  bar('lingot-or-250g', 'Lingot Or 250 G', 250, 999.9, 0.03),
  bar('lingot-or-100g', 'Lingot Or 100 G', 100, 999.9, 0.033, { featured: true }),
  bar('lingot-or-50g', 'Lingot Or 50 G', 50, 999.9, 0.038, { featured: true }),
  bar('lingot-or-once', 'Lingot Or Once', OZ, 999.9, 0.04, { offer: true, home: true }),
  bar('lingot-or-20g', 'Lingot Or 20 G', 20, 999.9, 0.055, { home: true }),
  bar('lingot-or-10g', 'Lingot Or 10 G', 10, 999.9, 0.07, { offer: true, home: true }),
  bar('lingot-or-5g', 'Lingot Or 5 G', 5, 999.9, 0.09, { offer: true }),
  bar('lingot-or-1g', 'Lingot Or 1 G', 1, 999.9, 0.30),
  bar('barre-or-12kg', "Barre d'Or 12,5 Kg", 12500, 995, 0.015, { maker: 'Barre LBMA Good Delivery', format: 'barre' }),
  { id: 'lingot-argent-1kg', name: 'Lingot Argent 1 Kg', category: 'lingot', metal: 'argent', weight: 1000, purity: 999, premium: 0.22, vat: true, maker: 'Fondeur certifié LBMA', featured: true },

  // ---------- Pièces d'or ----------
  coin('20-fr-coq', '20 Fr Or Coq', 6.45, 900, FR, 0.06, { short: '20 Francs', homeGold: true }),
  coin('10-fr-coq', '10 Fr Or Coq', 3.22, 900, FR, 0.10),
  coin('20-fr-napoleon-tete-nue', '20 Fr Or Napoléon Tête Nue', 6.45, 900, FR, 0.06),
  coin('10-fr-napoleon-tete-nue', '10 Fr Or Napoléon Tête Nue', 3.22, 900, FR, 0.10),
  coin('20-fr-napoleon-laure', '20 Fr Or Napoléon Lauré', 6.45, 900, FR, 0.09),
  coin('10-fr-napoleon-laure', '10 Fr Or Napoléon Lauré', 3.22, 900, FR, 0.10),
  coin('20-fr-genie', '20 Fr Or Génie', 6.45, 900, FR, 0.12),
  coin('20-fr-vreneli', '20 Fr Or Vreneli', 6.45, 900, CH, 0.07),
  coin('20-fr-confederation', '20 Fr Or Confédération', 6.45, 900, CH, 0.25),
  coin('10-fr-vreneli', '10 Fr Or Vreneli', 3.22, 900, CH, 0.10),
  coin('20-fr-tunisie', '20 Fr Or Tunisie', 6.45, 900, TN, 0.16),
  coin('20-mark', '20 Mark Or', 7.97, 900, DE, 0.07),
  coin('20-fr-italie', '20 Fr Or Italie', 6.45, 900, IT, 0.08),
  coin('20-fr-autriche', '20 Fr Or Autriche', 6.45, 900, AT, 0.08),
  coin('20-fr-belgique', '20 Fr Or Belgique', 6.45, 900, BE, 0.08),
  coin('souverain', 'Souverain Or', 7.99, 917, GB, 0.07, { short: 'Souverain', homeGold: true }),
  coin('souverain-elizabeth', 'Souverain Or Elizabeth II', 7.99, 917, GB, 0.09),
  coin('krugerrand', 'Krugerrand 1 Once', 33.93, 916.7, ZA, 0.04, { short: 'Krugerrand', homeGold: true }),
  coin('2-5-pesos', '2,5 Pesos Or', 2.08, 900, MX, 0.15, { isNew: true }),
  coin('tudor-licorne-or-1oz', 'Royal Tudor Beasts : Licorne de Seymour 1 Once Or', OZ, 999.9, GB, 0.06, { isNew: true }),
  coin('tudor-licorne-or-1-4', 'Royal Tudor Beasts : Licorne de Seymour 1/4 Once Or', OZ / 4, 999.9, GB, 0.11, { isNew: true }),

  // ---------- Pièces d'argent ----------
  { id: 'philharmonique-argent', name: 'Philharmonique 1 Once Argent', short: 'Philharmonique', category: 'piece', metal: 'argent', weight: OZ, purity: 999, country: AT, premium: 0.30, vat: true, homeSilver: true },
  { id: 'maple-argent', name: 'Maple Leaf 1 Once Argent', short: 'Maple', category: 'piece', metal: 'argent', weight: OZ, purity: 999.9, country: CA, premium: 0.31, vat: true, homeSilver: true },
  { id: 'britannia-argent', name: 'Britannia 1 Once Argent', short: 'Britannia', category: 'piece', metal: 'argent', weight: OZ, purity: 999, country: GB, premium: 0.29, vat: true, homeSilver: true },
  { id: 'tudor-lion-argent-2oz', name: "Royal Tudor Beasts : Lion d'Angleterre 2 Onces Argent", category: 'piece', metal: 'argent', weight: OZ * 2, purity: 999.9, country: GB, premium: 0.32, vat: true, isNew: true },

  // ---------- Pièces de platine ----------
  { id: 'lunar-dragon-platine', name: 'Australian Lunar Dragon 1 Once Platine', category: 'piece', metal: 'platine', weight: OZ, purity: 999.5, country: AU, premium: 0.12, vat: true, isNew: true },
  { id: 'tudor-licorne-platine', name: 'Royal Tudor Beasts : Licorne de Seymour 1 Once Platine', category: 'piece', metal: 'platine', weight: OZ, purity: 999.5, country: GB, premium: 0.12, vat: true, isNew: true },
  { id: 'tudor-taureau-platine', name: 'Royal Tudor Beasts : Taureau de Clarence 1 Once Platine', category: 'piece', metal: 'platine', weight: OZ, purity: 999.5, country: GB, premium: 0.12, vat: true, isNew: true },
].map((p, i) => ({ stock: 25, active: true, sort: i, ...p, fine: Math.round(p.weight * p.purity) / 1000 }));

export const COUNTRIES = {
  fr: 'France', ch: 'Suisse', tn: 'Tunisie', de: 'Allemagne', it: 'Italie', at: 'Autriche',
  be: 'Belgique', gb: 'Royaume-Uni', za: 'Afrique du Sud', mx: 'Mexique', ca: 'Canada', au: 'Australie',
};

export const METAL_LABEL = { or: 'Or', argent: 'Argent', platine: 'Platine' };
