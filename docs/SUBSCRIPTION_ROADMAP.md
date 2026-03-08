### Plan de Route : Intégration du Service d'Abonnement

**Objectif :** Mettre en place un flux de souscription robuste qui utilise le système de devis pour la vente initiale et la page "Abonnements" pour la gestion à long terme.

- [x] **Étape 1 : Standardiser la demande d'abonnement**
    - [x] Modifier la fonction `functions/create-subscription.js`.
    - [x] Objectif : Au lieu de créer un `abonnement`, la fonction doit créer une `demande` avec le type `SOUSCRIPTION_ABONNEMENT`.

- [x] **Étape 2 : Intégrer le nouveau type de demande au tableau de bord**
    - [x] Modifier `dashboard/src/Demandes.js` pour afficher les nouvelles demandes d'abonnement.
    - [x] Modifier `dashboard/src/DemandesEnCours.js` pour afficher les demandes d'abonnement en cours.
    - [x] Objectif : Ajouter une icône (ex: 🔄) et les filtres nécessaires pour identifier et gérer facilement ce nouveau type de demande.

- [x] **Étape 3 : Activer la création de devis pour les abonnements**
    - [x] Modifier `dashboard/src/DemandeDetail.js`.
    - [x] Objectif : Rendre le bouton **"Créer Devis"** fonctionnel pour les demandes de type `SOUSCRIPTION_ABONNEMENT` qui ont été confirmées.

- [x] **Étape 4 : Connecter le flux de paiement au système d'abonnements**
    - [x] Identifier et modifier la fonction qui confirme le paiement d'une facture.
    - [x] Objectif : Lorsqu'une facture issue d'une demande de type `SOUSCRIPTION_ABONNEMENT` est payée, la fonction doit automatiquement créer une nouvelle entrée dans la table `abonnements` avec le statut `actif`.

- [x] **Étape 5 : Finaliser la page de gestion des abonnements**
    - [x] Revoir la page `dashboard/src/pages/Abonnements.js`.
    - [x] Objectif : Confirmer que son rôle est bien la gestion des abonnements `actifs`, `en_pause` ou `terminés`. Le statut `en_attente` devient obsolète et pourra être retiré.

- [x] **Étape 6 : Mise en place de la génération manuelle des factures récurrentes**
    - [x] Ajouter les colonnes `monthly_price`, `next_billing_date`, `last_invoice_date`, `original_demand_id` à la table `abonnements`.
    - [x] Mettre à jour `Factures.js` pour enregistrer `original_demand_id` lors de la création de l'abonnement.
    - [x] Implémenter la fonction `generate-recurring-invoice.js` pour créer des factures récurrentes.
    - [x] Mettre à jour `Abonnements.js` (UI) pour permettre la génération manuelle des factures récurrentes et la gestion du `monthly_price` et `next_billing_date`.
    - [x] Mettre à jour `App.js` et `Sidebar.js` pour afficher un badge d'avertissement si `monthly_price` n'est pas défini.

### Phase 2 : Améliorations Futures pour la Gestion des Abonnements (Optionnel)

Voici quelques pistes pour aller plus loin et automatiser davantage le processus :

- [ ] **Étape 7 : Automatisation Complète de la Facturation Mensuelle**
    - [ ] **Le concept :** Utiliser un Supabase Scheduled Function (Cron Job) pour déclencher automatiquement la fonction `generate-recurring-invoice` chaque mois.
    - [ ] **Objectif :** Supprimer la nécessité d'une intervention manuelle pour générer les factures récurrentes.
    - [ ] **Détails :** La fonction planifiée vérifierait les abonnements dont la `next_billing_date` est atteinte et générerait les factures correspondantes.

- [ ] **Étape 8 : Gestion des Retards de Paiement et Rappels Automatiques**
    - [ ] **Le concept :** Suivre les factures d'abonnement impayées et envoyer des rappels automatiques.
    - [ ] **Objectif :** Automatiser le processus de relance et réduire les retards de paiement.
    - [ ] **Détails :** Une tâche pourrait vérifier périodiquement les factures `pending` ou `overdue`, envoyer des e-mails de rappel, et éventuellement changer le statut de l'abonnement si le paiement n'est pas reçu après un certain délai.

- [ ] **Étape 9 : Création d'un Portail Client / Espace Abonné**
    - [ ] **Le concept :** Offrir un espace sécurisé aux clients pour gérer leur abonnement.
    - [ ] **Objectif :** Améliorer l'expérience client et réduire la charge administrative.
    - [ ] **Détails :** Les clients pourraient consulter leurs factures, modifier leurs informations, ou gérer le statut de leur abonnement (pause/résiliation) via une interface dédiée.

- [ ] **Étape 10 : Optimisation de la Logique de Date de Facturation**
    - [ ] **Le concept :** Assurer des cycles de facturation plus prévisibles.
    - [ ] **Objectif :** Éviter les décalages de date et uniformiser les dates de facturation mensuelles.
    - [ ] **Détails :** Permettre de définir un jour fixe du mois pour la `next_billing_date`, plutôt que simplement "+1 mois" à partir de la dernière génération.

### Phase 3 : Intégration du Calculateur Nutritionnel et Connexion au Portail Client (Optionnel)

Ce serait une étape majeure pour offrir une expérience plus personnalisée et interactive à vos clients, en particulier ceux qui souscrivent aux formules "Performance" et "Premium".

- [ ] **Étape 11 : Mise en place de l'Authentification Client**
    - [ ] **Le concept :** Intégrer un système d'authentification des utilisateurs (par exemple, Supabase Auth) sur la partie publique du site.
    - [ ] **Objectif :** Permettre aux clients de créer un compte et de se connecter à un espace personnel.

- [ ] **Étape 12 : Développement du Profil Client**
    - [ ] **Le concept :** Créer une page "Mon Profil" dans l'espace client.
    - [ ] **Objectif :** Permettre aux clients d'entrer et de sauvegarder leurs données personnelles (âge, poids, taille, niveau d'activité, etc.). Ces données seraient stockées dans la table `clients` ou une nouvelle table `client_profiles`.

- [ ] **Étape 13 : Intégration et Pré-remplissage du Calculateur Nutritionnel**
    - [ ] **Le concept :** Intégrer le contenu de `calculateur.html` dans l'espace client.
    - [ ] **Objectif :** Rendre le calculateur accessible aux clients connectés et pré-remplir les champs avec leurs données de profil.
    - [ ] **Détails :** Le calculateur utiliserait les données sauvegardées pour estimer les besoins caloriques du client.

- [ ] **Étape 14 : Connexion du Calculateur aux Abonnements**
    - [ ] **Le concept :** Utiliser les résultats du calculateur pour personnaliser les abonnements.
    - [ ] **Objectif :** Joindre le besoin calorique calculé à la demande d'abonnement du client.
    - [ ] **Détails :** Lors de la souscription à une formule "Performance" ou "Premium" depuis l'espace client, le besoin calorique estimé serait enregistré avec la demande, et finalement associé à l'abonnement actif pour vous aider à préparer les plats.

### Phase 4 : Développement de la Base de Données Nutritionnelle (Optionnel)

Cette phase est essentielle pour rendre le calculateur nutritionnel dynamique et capable de gérer des produits spécifiques, notamment locaux.

- [ ] **Étape 15 : Création de la Table `aliments`**
    - [ ] **Le concept :** Une table pour stocker les informations nutritionnelles de base de chaque ingrédient.
    - [ ] **Objectif :** Avoir une base de données flexible pour les produits génériques et locaux.
    - [ ] **Colonnes suggérées :** `id` (UUID), `nom` (texte), `unité` (texte, ex: "g", "ml", "pièce"), `calories_par_100` (numérique), `proteines_par_100` (numérique), `glucides_par_100` (numérique), `lipides_par_100` (numérique), `source_donnees` (texte, ex: "CIQUAL", "Custom").

- [ ] **Étape 16 : Création de la Table `recettes`**
    - [ ] **Le concept :** Une table pour définir les plats composés d'ingrédients.
    - [ ] **Objectif :** Gérer les plats de manière structurée.
    - [ ] **Colonnes suggérées :** `id` (UUID), `nom` (texte), `description` (texte), `instructions` (texte).

- [ ] **Étape 17 : Création de la Table de Liaison `recette_ingredients`**
    - [ ] **Le concept :** Une table pour lier les aliments aux recettes et spécifier les quantités.
    - [ ] **Objectif :** Permettre le calcul des valeurs nutritionnelles agrégées pour chaque recette.
    - [ ] **Colonnes suggérées :** `recette_id` (clé étrangère vers `recettes.id`), `aliment_id` (clé étrangère vers `aliments.id`), `quantite` (numérique).

- [ ] **Étape 18 : Interface d'Administration pour la Base de Données Nutritionnelle**
    - [ ] **Le concept :** Développer une interface dans le tableau de bord pour gérer les nouvelles tables.
    - [ ] **Objectif :** Permettre à l'administrateur d'ajouter, modifier et supprimer des aliments et des recettes.

- [ ] **Étape 19 : Adaptations du Calculateur pour les Recettes**
    - [ ] **Le concept :** Modifier le calculateur pour qu'il puisse afficher les valeurs nutritionnelles des recettes.
    - [ ] **Objectif :** Fournir des informations détaillées sur les plats proposés aux clients.

### Phase 5 : Refonte du Flux de Souscription (Optionnel)

Cette phase vise à rendre le système d'abonnement plus autonome et distinct du système de demandes ponctuelles.

- [ ] **Étape 20 : Création d'un Flux de Souscription Dédié**
    - [ ] **Le concept :** Le formulaire de la page `abonnements.html` ne crée plus une `demande` mais directement un `abonnement`.
    - [ ] **Objectif :** Rendre le modèle de données plus clair et dissocier la logique de souscription de celle des demandes uniques.
    - [ ] **Détails :** Le nouvel abonnement aurait un statut initial comme `devis_a_creer`.

- [ ] **Étape 21 : Adaptation de la Page de Gestion des Abonnements**
    - [ ] **Le concept :** La page `Abonnements.js` serait mise à jour pour gérer ce nouveau statut.
    - [ ] **Objectif :** Créer un onglet ou un filtre pour "Abonnements en attente de devis".
    - [ ] **Détails :** L'administrateur pourrait alors cliquer sur "Créer Devis" depuis cette interface pour initier le processus de facturation initiale, en réutilisant le système de devis existant.