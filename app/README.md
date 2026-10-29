# Application de la synagogue (Beth Chalom)

Une seule application pour **iPhone (App Store)**, **Android (Play Store)**, **ordinateur** (Windows / Mac, à installer
depuis le navigateur) et **site web**. Elle reprend les données de l'écran TV : quand on modifie l'écran depuis
l'administration, l'application change aussi.

| Onglet | Contenu |
|---|---|
| Accueil | Date (française + hébraïque), heure, prochain office avec compte à rebours, offices du jour, Chabbat (paracha, entrée, sortie), Roch Hodech, annonces, dédicace |
| Horaires | Offices des 15 prochains jours |
| Menu | Photo de la synagogue, recherche, toutes les rubriques |
| Siddour | Rite séfarade (Edot HaMizrah, Sefaria, domaine public), taille du texte réglable, lecture hors connexion une fois ouvert |
| Calendrier | Calendrier juif du mois (Hebcal, en français) : fêtes, Roch Hodech, jeûnes, paracha, heures de Chabbat |
| Zmanim | 30 jours à l'avance |
| Cours à la synagogue | Programme par jour (table `courses`) |
| Halakha Yomit / Daf Hayomi | Lecture du jour (Sefaria) : texte original + traduction anglaise |
| Cours en vidéo | Vidéos YouTube (table `videos`, mettre la fin du lien) |
| Galerie | Photos par album (table `gallery`) |
| Boutique | Articles avec **référence**, catégorie, recherche, **commentaire demandé à l'achat** pour certains articles (dédicace, plaque…), panier |
| Dons | Motif (don, cotisation, kibboud, neder, hazkara…), montant, dédicace |
| Compte | Création de compte, connexion, mot de passe oublié, profil, historique des commandes et dons, suppression du compte |

Payer demande un compte. Le paiement se fait sur **Stripe** (carte bancaire, Apple Pay, Google Pay).

## Lancer sur l'ordinateur

```bash
cd app
npm install
npm run dev        # http://localhost:5173
```

Sans fichier `.env`, l'application est en **mode démonstration** : comptes et commandes sont gardés sur l'appareil,
aucun paiement n'est encaissé.

## Brancher les vrais comptes et paiements

1. **Supabase** (gratuit pour commencer) : créer un projet sur supabase.com, puis SQL Editor → coller `supabase/schema.sql` → Exécuter.
2. **Stripe** : créer le compte au nom de l'association (IBAN, SIRET/RNA), récupérer la clé secrète.
3. Fonctions serveur :
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-du-projet>
   npx supabase secrets set STRIPE_SECRET_KEY=sk_live_… STRIPE_WEBHOOK_SECRET=whsec_… APP_RETURN_URLS=https://app.exemple.fr/
   npx supabase functions deploy checkout
   npx supabase functions deploy stripe-webhook --no-verify-jwt
   npx supabase secrets set ADMIN_TOKEN_SECRET=<un long texte au hasard> REMOTE_URL=<adresse de la base Google de l'écran>
   npx supabase functions deploy admin --no-verify-jwt
   ```
   Dans Stripe → Développeurs → Webhooks : ajouter `https://<ref>.supabase.co/functions/v1/stripe-webhook`
   avec les événements `checkout.session.completed` et `checkout.session.expired`.
4. Copier `.env.example` en `.env` et remplir `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WEB_URL`.
5. Gérer les articles : Supabase → Table Editor → `products` (référence, nom, prix en centimes, stock, `comment_label`
   pour demander un commentaire). Donner les droits d'administration : `profiles.is_admin = true`.

## iPhone et Android

```bash
npm run cap:android   # ouvre Android Studio → Run (téléphone branché) ou Build → Generate Signed Bundle
npm run cap:ios       # ouvre Xcode (sur Mac uniquement) → Product → Archive → envoi App Store Connect
```

Identifiant de l'application : `fr.bethchalom.app` (dans `capacitor.config.ts`, à choisir avant la 1re publication).

## Ce qu'il faut pour publier

| | Coût | Qui |
|---|---|---|
| Compte **Apple Developer** (au nom de l'association, numéro D-U-N-S gratuit) | 99 $/an (exonération possible pour une association à but non lucratif, à demander à Apple) | Président de l'association |
| Compte **Google Play Console** (organisation) | 25 $ une fois | Idem |
| Un **Mac** avec Xcode pour envoyer la version iPhone (ou un service en ligne comme Codemagic) | — | — |
| Icône 1024×1024, captures d'écran, texte de présentation, **page de confidentialité** | — | — |
| Compte **Stripe** de l'association | 1,5 % + 0,25 € par paiement européen | Trésorier |

Points de vigilance pour Apple / Google :
- Objets physiques (livres, kippot, plaques) : paiement Stripe autorisé.
- **Dons** dans l'appli iPhone : réservés aux associations **reconnues par Apple** comme organisme à but non lucratif,
  avec Apple Pay proposé. Sinon, le bouton « Faire un don » doit ouvrir le site dans Safari. À vérifier avant l'envoi.
- La suppression du compte depuis l'appli est obligatoire : c'est fait (Compte → Supprimer mon compte).

## Organisation du code

- `src/lib/zmanim.ts` : calculs repris de l'écran TV (Hebcal, zmanim, calendrier des offices)
- `src/lib/synagogue.tsx` : réglages partagés avec les écrans (base Google), copie hors connexion
- `src/lib/backend.ts` : comptes, boutique, commandes, dons (Supabase, ou démonstration)
- `src/pages/` : les 6 écrans
- `supabase/` : base de données et fonctions de paiement
- `android/`, `ios/` : projets natifs générés par Capacitor (`npx cap sync` après chaque `npm run build`)

## Feuille des horaires du mois (écran TV + application)

Une seule feuille pour tout : `synagogue-display-theme/assets/synagogue-horaires.json` sur la branche `main`.
L'écran TV et l'application la lisent en ligne (adresse GitHub, actualisée en 5 minutes environ) et gardent une copie
pour les coupures d'Internet. Chaque mois : envoyer le PDF de la feuille des horaires → il est converti dans ce fichier →
enregistré sur `main` → les télévisions (toutes les 6 h, ou en rechargeant) et les téléphones (à l'ouverture) suivent seuls.
Les réglages (offices de la semaine type, annonces, dédicace, ville) restent ceux de l'administration de l'écran.

## Espace administrateur (Menu › Espace administrateur, ou Compte › Espace administrateur)

- Entrée avec **un code, sans e-mail** : le même code que l'administration de l'écran (vérifié par la base Google, blocage
  après 10 essais faux). Pour un code propre à l'application : `npx supabase secrets set ADMIN_CODE=…`.
- **Tableau de bord** : membres inscrits, dons du mois, total des dons, boutique, dernières activités, groupes.
- **Membres** : recherche, filtre par balise, total donné par chacun, fiche avec l'historique complet (dons, dédicaces,
  articles et commentaires), balises et note privée, sélection pour écrire à plusieurs, export Excel.
- **Dons et achats** : tout, ou seulement les dons / la boutique, total payé, export Excel (comptabilité, reçus fiscaux).
- **Messages** :
  - *Conversations* : chaque membre a sa conversation privée avec l'administration (il écrit depuis Compte › Messages,
    l'administration répond ; pastille des non-lus des deux côtés).
  - *Envoi groupé et rappels* : message ou **rappel de paiement** (montant + motif) à tous, à des balises ou aux membres
    cochés. Le rappel arrive dans la conversation du membre avec un bouton « Payer » qui ouvre le don déjà rempli.
- Les membres **restent connectés** sur leur téléphone (session gardée et renouvelée seule) jusqu'à « Se déconnecter ».

## Paiements (Stripe)

- **Moyens** : carte bancaire, Apple Pay, Google Pay, prélèvement SEPA, Link — ceux cochés dans Stripe › Paramètres ›
  Moyens de paiement (aucun code à changer). La carte est saisie sur la page sécurisée de Stripe, jamais chez nous.
- **Dons ponctuels ou mensuels** (« Chaque mois ») ; le membre arrête son don mensuel ou change de carte depuis son compte
  (espace client Stripe). Chaque mois payé crée une ligne dans Paiements.
- **États suivis automatiquement** (webhook) : en attente, prélèvement en cours (SEPA, 3 à 5 jours), payé, échoué, annulé,
  remboursé. Reçu Stripe envoyé par e-mail et consultable dans le compte.
- **Administration › Paiements** : dons mensuels actifs (total par mois, arrêt), tous les paiements filtrés par type et
  par état, fiche de chaque paiement, **remboursement total ou partiel** avec confirmation, export Excel.
- **Test sans argent réel** : mettre la clé `sk_test_…` ; carte 4242 4242 4242 4242 (acceptée), 4000 0000 0000 0002
  (refusée), IBAN de test FR1420041010050500013M02606. Puis remplacer par `sk_live_…` pour ouvrir les vrais paiements.
- Webhook : `https://<ref>.supabase.co/functions/v1/stripe-webhook`, événements : checkout.session.completed,
  checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, invoice.paid,
  customer.subscription.updated, customer.subscription.deleted, charge.refunded.
- Stripe › Paramètres › Espace client : autoriser « annuler l'abonnement » et « modifier le moyen de paiement ».

## Langues

Français et anglais (Menu ou Compte › Français / English ; toujours en français au départ). Les textes sont dans
`src/lib/i18n.ts` : le français sert de clé, la traduction anglaise à côté. L'espace administrateur reste en français.

## Sécurité

- **Mot de passe** : 10 caractères minimum, minuscule + majuscule + chiffre, ni le nom ni l'e-mail, pas de mot trop courant
  (jauge et règles affichées pendant la saisie). À régler aussi côté serveur, dans Supabase › Authentication › Policies :
  longueur minimale 10, « lowercase, uppercase letters and digits », **Leaked password protection** activée,
  **Confirm email** activé. Supabase limite aussi le nombre d'essais de connexion.
- **Téléphone** : France (+33, 9 chiffres après l'indicatif) ou États-Unis / Canada (+1, 10 chiffres), enregistré au format
  international ; refusé par la base s'il est mal formé (contrainte SQL `profiles_phone_format`).
- **Administration** : code vérifié par le serveur, blocage après 10 codes faux en 10 minutes, session de 12 h.
- **Paiement** : carte saisie chez Stripe uniquement ; prix recalculés par le serveur ; webhook signé.
- **Données** : chaque membre ne lit que son profil, ses commandes, ses messages (règles RLS de `schema.sql`) ;
  photos envoyées par lien signé dans le dossier `media`.

## Reçus et notifications

- Après chaque paiement, le membre reçoit : le reçu Stripe par e-mail, un message de confirmation dans sa conversation,
  et un **reçu** consultable, imprimable et enregistrable en PDF dans Compte › Mes commandes et dons.
- L'administration voit les **nouveaux paiements** en tête du tableau de bord (pastille sur l'onglet Paiements) et peut
  recevoir un **e-mail à chaque paiement** : `npx supabase secrets set RESEND_API_KEY=… ADMIN_EMAIL=… MAIL_FROM="Synagogue <contact@…>"`
  (compte gratuit sur resend.com). Stripe peut aussi envoyer ses propres alertes (Stripe › Paramètres › Notifications).

## Contenus

Aucun exemple : la boutique, les cours, les vidéos et la galerie se remplissent dans Administration › Contenus
(+ Ajouter, Modifier, Supprimer ; photos envoyées depuis le téléphone, réduites automatiquement).

## Association, reçus fiscaux, pages légales, icônes

- **Administration › Association** : nom officiel, adresse, RNA / SIRET, objet, contact, président(e), type d'organisme,
  « peut délivrer des reçus fiscaux ». Ces informations remplissent les reçus, les reçus fiscaux et les pages légales.
- **Reçu fiscal** (modèle Cerfa n° 11580, art. 200 du CGI) : bouton « Reçu fiscal » sur le reçu de chaque don payé,
  si l'option est activée et l'adresse du donateur renseignée ; numéro d'ordre à la suite attribué par le serveur,
  montant en toutes lettres, imprimable / PDF.
- **Confidentialité** et **Conditions de vente et de don** : Menu et Compte (exigées par l'App Store et le Play Store).
- **Icônes** : `resources/icon.png` (1024 px) ; pour iPhone et Android : `npx @capacitor/assets generate`.
