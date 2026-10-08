# Synagogue Display — thème Shopify

Port du projet Next.js `synagogue-display` en thème Shopify autonome (aucun serveur à héberger).

- **Écran TV** : la page d'accueil de la boutique (`/`). Scène 1920×1080 mise à l'échelle, horloge, offices, zmanim, Chabbat, annonces.
- **Administration** : l'éditeur de thème Shopify (Boutique en ligne → Thèmes → Personnaliser).
  Nom, ville (identifiant GeoNames), bougies, havdala, altitude, offices (blocs « Office »), annonces (3 max),
  zmanim (blocs « Zman » : ordre par glisser-déposer, méthode de calcul par bloc). Le logo ✡ de l'écran mène à l'admin.
- **Synchro multi-écrans** : chaque écran vérifie toutes les 5 min si les réglages publiés ont changé et se recharge.
- **Hebcal** : appelé directement depuis le navigateur (CORS ouvert) : 1 requête zmanim pour 31 jours + 1 requête calendrier,
  cache `localStorage`, rafraîchi toutes les 6 h, au changement de jour et au retour d'Internet.
- **Date hébraïque** : `@hebcal/core` 5.9.0 empaqueté dans `assets/hebcal-core.js` (esbuild, IIFE, global `HebcalCore`).

Différence avec la version Next.js : plus de route `/api/*` ni de code admin `ADMIN_CODE` — l'accès admin est celui
du compte Shopify. La recherche de ville en direct n'est pas possible (l'API `hebcal.com/complete` n'autorise pas
les appels navigateur) : on saisit l'identifiant GeoNames de la ville.

Les horaires d'offices fournis sont des données de démonstration. Les méthodes de calcul sont à faire valider par le Rav.
