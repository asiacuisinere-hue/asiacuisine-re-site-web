### Plan de Route : Amélioration des Offres Spéciales (Variantes Flexibles)

**Objectif :** Rendre les offres spéciales plus flexibles pour permettre des produits vendus à la pièce, au poids, ou sous d'autres formats via un système de "variantes" par plat.

- [ ] **Étape 1 : Mise à jour de la structure de données des offres spéciales**
    - [ ] Modifier la fonction `handleSaveSpecialOffer` dans `dashboard/src/pages/Parametres.js`.
    - [ ] Objectif : Enregistrer chaque plat avec un tableau `variants` (contenant `libelle` et `prix`) au lieu de champs fixes `price500`, `price1000`.
    - [ ] Modifier la fonction `addDish` dans `dashboard/src/pages/Parametres.js`.
    - [ ] Objectif : Initialiser les nouveaux plats avec un tableau `variants` vide ou par défaut.
    - [ ] Mettre à jour la logique de chargement de l'offre spéciale dans `fetchAllSettings` (`Parametres.js`).
    - [ ] Objectif : S'assurer que le chargement depuis la base de données s'adapte à la nouvelle structure `dishes.variants`.

- [ ] **Étape 2 : Adaptation de l'interface d'administration (`Parametres.js`)**
    - [ ] Modifier le JSX de la section de gestion des plats (où les plats de l'offre spéciale sont listés).
    - [ ] Objectif : Remplacer les champs "Prix 500g" / "Prix 1000g" par un système dynamique de saisie des variantes. Chaque plat aura :
        - Un bouton "Ajouter une variante"
        - Pour chaque variante, deux champs : "Libellé" (ex: "500g", "La pièce", "Par 4") et "Prix".
        - Un bouton "Supprimer" pour chaque variante.

- [ ] **Étape 3 : Adaptation de l'interface client (`menu.js`)**
    - [ ] Modifier la fonction `renderSpecialOffer` dans `menu.js`.
    - [ ] Objectif : Générer dynamiquement le menu déroulant des "portions" (maintenant "variantes") en fonction du tableau `variants` du plat sélectionné.
    - [ ] Modifier la fonction `handleAddToCart` dans `menu.js`.
    - [ ] Objectif : Adapter la logique de calcul du prix pour qu'elle récupère le prix de la variante sélectionnée.

- [ ] **Étape 4 : Mise à jour de la logique de facture (`send-invoice-by-email/index.ts`)**
    - [ ] Modifier la fonction `send-invoice-by-email/index.ts`.
    - [ ] Objectif : Adapter la logique de création des `items` de la facture pour `COMMANDE_SPECIALE` afin qu'elle utilise la nouvelle structure `dishes.variants`.

- [ ] **Étape 5 : Mise à jour des traductions (`locales/*.json`)**
    - [ ] Revoir et ajouter les traductions nécessaires pour les nouveaux libellés ("Libellé de la variante", etc.) dans `fr.json`, `en.json`, et `zh.json`.
