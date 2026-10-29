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
- **Messages** : à tous, à une ou plusieurs balises, ou aux membres cochés ; suivi « lu par » ; les membres les lisent dans
  Compte › Messages.
