# Maurice Or

Site d'achat et de vente d'or au cours en direct, réalisé d'après la maquette Canva (PDF).

## Ce que fait le site

- **Design moderne** (noir, or, beaucoup d'air), pensé d'abord pour le téléphone (barre de navigation en bas, comme une application).
- **Cours de l'or automatique** : relevé toutes les 2 minutes (or, argent, platine). Tous les prix du site se recalculent tout seuls.
- **Boutique** : pièces, lingots, argent & platine, en grille ou en liste ; fiche produit avec prix dégressifs, valeur du métal et marge affichées.
- **Espace client « comme à la banque »** (`#/espace`) :
  - carte « Valeur totale de mon compte » (or au gramme, coffre, solde, montant réservé) ;
  - boutons rapides : Acheter, Vendre, Alimenter, Retirer, Me faire livrer, Conseiller WhatsApp ;
  - Acheter / Vendre (au gramme, en € ou en grammes, ou un lingot / une pièce), avec récapitulatif clair avant chaque opération ;
  - Mon coffre, Opérations, Commandes, Sécurité (code sur téléphone), Profil, notifications.
- **Deuxième confirmation par l'administrateur** : chaque achat (or au gramme, lingot, commande) devient une demande. Le prix est bloqué et l'argent du client mis de côté ; l'admin valide ou refuse. Sans réponse dans le délai (30 min par défaut), tout est rendu automatiquement au client. Réglable dans Administration → Réglages (aussi pour les ventes).
- **WhatsApp partout** : bouton flottant, espace client, fiches produits, commandes, avec le numéro client déjà dans le message. Côté admin, un bouton WhatsApp pour écrire à chaque client.
- **Administration** (`#/admin`) :
  - Tableau de bord en direct ; **À valider** (prix bloqué comparé au cours actuel, compte à rebours) ;
  - **Activité en direct** : tout ce que font les clients (produits regardés, panier, achats commencés, abandonnés, connexions, erreurs de mot de passe…) ;
  - **Abandons & intentions** : qui s'est arrêté à quoi, son panier, avec un message WhatsApp de relance prêt ;
  - **Fiche client** : coordonnées, soldes, coffre, panier en cours, historique complet ;
  - Commandes, versements, retraits, produits & prix, messages, réglages.

## Sécurité

Mots de passe chiffrés (scrypt), verrouillage après 5 erreurs, double authentification (code à 6 chiffres) optionnelle, cookies de session protégés, protection CSRF, en-têtes de sécurité, déconnexion après 4 h d'inactivité, prix toujours recalculés côté serveur (impossible de tricher sur le prix), achats validés par l'administrateur, achats bloqués si le cours n'est plus à jour, retraits confirmés par mot de passe et vérification de l'IBAN, journal de toutes les actions.

## Lancer le site

Il faut Node.js 20 ou plus. Aucune installation de paquets n'est nécessaire.

```
cp .env.example .env     # puis remplir
npm start                # http://localhost:3000
npm test                 # tests automatiques
```

1. Mettez votre e-mail dans `ADMIN_EMAILS`, puis inscrivez-vous sur le site : vous êtes administrateur.
   (Ou pour un compte existant : `node server/index.js admin moi@exemple.fr`.)
2. Dans **Administration → Réglages**, renseignez **votre numéro WhatsApp**, l'adresse de la boutique, le téléphone et **votre IBAN**.
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
