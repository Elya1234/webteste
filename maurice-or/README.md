# Maurice Or

Site d'achat et de vente d'or au cours en direct, réalisé d'après la maquette Canva (PDF).

## Ce que fait le site

- **Cours de l'or automatique** : relevé toutes les 2 minutes (or, argent, platine — en €, £, $). Tous les prix du site se recalculent tout seuls.
- **Accueil** comme la maquette : cours de l'or, cases Pièces / Gramme / Lingots, graphique, pièces d'or et d'argent, tableau des cours, lingots, nouveautés du mois, pied de page.
- **Achat pièces**, **Achat lingots**, **Achat au gramme**, **Investir dans l'or** (« Triez vos produits »), **fiche produit** (QTÉ, ACHETER, prix dégressifs), **panier**.
- **Compte sécurisé avec portefeuille or** (« Son compte ») : Gramme / Lingots / Total or / Solde, boutons Acheter un gramme, Vendre un gramme, Acheter un lingot.
  - Alimenter son solde (carte ou virement), retirer vers son compte bancaire.
  - Coffre : les lingots/pièces achetés restent stockés, revendables en 1 clic ou **livrés chez le client** / retirés en boutique.
- **Commande** : livraison assurée à domicile, retrait en boutique ou garde au coffre ; paiement par solde, carte ou virement.
- **Administration** (`#/admin`) : commandes (payée, expédiée…), versements à valider, retraits à faire, primes et stocks des produits, clients, messages, réglages (marges, frais de port, IBAN, adresse boutique).

## Sécurité

Mots de passe chiffrés (scrypt), verrouillage après 5 erreurs, double authentification (code à 6 chiffres) optionnelle, cookies de session protégés, protection CSRF, en-têtes de sécurité, déconnexion après 4 h d'inactivité, prix toujours recalculés côté serveur (impossible de tricher sur le prix), achats bloqués si le cours n'est plus à jour, retraits confirmés par mot de passe et vérification de l'IBAN.

## Lancer le site

Il faut Node.js 20 ou plus. Aucune installation de paquets n'est nécessaire.

```
cp .env.example .env     # puis remplir
npm start                # http://localhost:3000
npm test                 # tests automatiques
```

1. Mettez votre e-mail dans `ADMIN_EMAILS`, puis inscrivez-vous sur le site : vous êtes administrateur.
   (Ou pour un compte existant : `node server/index.js admin moi@exemple.fr`.)
2. Dans **Administration → Réglages**, renseignez l'adresse de la boutique, le téléphone et **votre IBAN**.
3. Ajustez les primes et stocks dans **Produits & prix**.

**Paiement par carte** : créez un compte Stripe, mettez `STRIPE_SECRET_KEY`, et ajoutez un webhook vers `https://votre-site/api/stripe/webhook` (événement `checkout.session.completed`) avec son secret dans `STRIPE_WEBHOOK_SECRET`. Sans Stripe, le virement et le solde fonctionnent.

**Hébergement** : n'importe quel hébergeur Node.js (Render, Railway, Fly.io, un VPS…), en HTTPS, avec un disque persistant pour le dossier `data/` (sauvegarde automatique quotidienne dans `data/backups/`, gardée 60 jours).

## Mode démo

Ouvert sans serveur (ex. GitHub Pages : `…/maurice-or/public/`), le site passe tout seul en **mode démo** : vrai cours de l'or, mais données gardées dans le navigateur et paiements simulés. Comptes d'essai :
- client : `client@maurice-or.fr` / `Client-demo-2026`
- admin : `admin@maurice-or.fr` / `Admin-demo-2026`

## À faire avant l'ouverture

- Vrai nom / logo si « Maurice Or » doit changer (réglage « Nom » + `index.html`).
- Mentions légales (SIRET…), CGV à faire relire par un juriste, obligations anti-blanchiment (pièces d'identité au-delà des seuils).
- Photos réelles des produits (facultatif) : les illustrations sont dessinées automatiquement ; on peut ajouter un champ `image` dans `public/js/shared/catalog.js`.
- Les offres « 0 % de commission » de la maquette (lingots Once, 10 g, 5 g) vendent au prix du métal, sans marge : à décocher dans l'admin si besoin.
