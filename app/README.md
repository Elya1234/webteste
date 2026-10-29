# Application de la synagogue (Beth Chalom)

Une seule application pour **iPhone (App Store)**, **Android (Play Store)**, **ordinateur** (Windows / Mac, à installer
depuis le navigateur) et **site web**. Elle reprend les données de l'écran TV : quand on modifie l'écran depuis
l'administration, l'application change aussi.

| Onglet | Contenu |
|---|---|
| Accueil | Date (française + hébraïque), heure, prochain office avec compte à rebours, offices du jour, Chabbat (paracha, entrée, sortie), Roch Hodech, annonces, dédicace |
| Horaires | 8 jours à l'avance : offices + zmanim de chaque jour |
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
