# Plan de Développement : Web App de Gestion Unifiée Asiacuisine.re

Ce document décrit les étapes de développement pour la création d'une application de gestion centralisée sur un sous-domaine (ex: `gestion.asiacuisine.re`). Cette application gérera les **commandes de menus**, les **réservations de services pour particuliers**, et les **demandes pour entreprises**.

---

### Phase 1 : Socle Technique et Authentification (Inchangé)

*   [ ] **1.1. Initialisation du projet**
*   [ ] **1.2. Configuration du sous-domaine**
*   [ ] **1.3. Mise en place de l'authentification administrateur**

---

### Phase 2 : Modélisation des Données Unifiées

*   [ ] **2.1. Création de la table `clients` :**
    *   [ ] Définir et créer la table `clients` dans Supabase.
    *   [ ] Inclure un champ `type` ("Particulier" ou "Entreprise").
    *   [ ] Prévoir des champs conditionnels (SIRET, nom de l'entreprise) pour le type "Entreprise".

*   [ ] **2.2. Création de la table `demandes` :**
    *   [ ] Définir et créer une table `demandes` unifiée, liée à la table `clients`.
    *   [ ] Inclure un champ `type` pour distinguer les demandes : `COMMANDE_MENU`, `RESERVATION_PARTICULIER`, `DEMANDE_ENTREPRISE`.
    *   [ ] Inclure des champs communs : `date_demande`, `statut` (Nouvelle, Devis envoyé, Confirmée, Terminée, Annulée), `montant_total`.
    *   [ ] Inclure des champs spécifiques (qui peuvent être `null`) pour les détails de la demande.

---

### Phase 3 : API Centralisée et Migration des Formulaires

*   [ ] **3.1. Création de l'API de réception :**
    *   [ ] Créer une nouvelle fonction Cloudflare (`/api/create-request`) qui reçoit les données de tous les formulaires.
    *   [ ] Sécuriser l'endpoint avec une clé API.
    *   [ ] Implémenter la logique pour insérer les données dans les tables `clients` et `demandes` en fonction du type de demande.

*   [ ] **3.2. Mise à jour du formulaire de la page `menu.html` :**
    *   [ ] Modifier le JavaScript pour qu'il envoie les données à la nouvelle API.

*   [ ] **3.3. Mise à jour du formulaire de la page `index.html` :**
    *   [ ] Modifier le JavaScript pour qu'il envoie les données à la nouvelle API.

*   [ ] **3.4. (Futur) Création d'un formulaire pour les entreprises :**
    *   [ ] Créer une nouvelle page ou section sur le site vitrine dédiée aux services pour entreprises, avec un formulaire de contact/devis détaillé.

---

### Phase 4 : Interface de Gestion Unifiée

*   [ ] **4.1. Interface de gestion des demandes :**
    *   [ ] Créer une page `/demandes` pour lister toutes les demandes.
    *   [ ] Ajouter des filtres pour voir par type (`COMMANDE_MENU`, `RESERVATION_PARTICULIER`, `DEMANDE_ENTREPRISE`), par statut ou par date.
    *   [ ] Afficher les demandes sous forme de tableau ou de cartes (type Kanban).

*   [ ] **4.2. Interface de gestion des clients :**
    *   [ ] Créer une page `/clients` pour lister tous les clients (particuliers et entreprises).
    *   [ ] Afficher l'historique des demandes pour chaque client.

---

### Phase 5 : Devis et Facturation Centralisés

*   [ ] **5.1. Création de la table `documents` :**
    *   [ ] Définir et créer une table `documents` (liée à la table `demandes`) pour stocker les devis et factures.

*   [ ] **5.2. Génération de PDF :**
    *   [ ] Créer une fonction Cloudflare (`/api/generate-document`) qui génère un devis ou une facture en PDF.

*   [ ] **5.3. Interface de facturation :**
    *   [ ] Sur la page de détail d'une demande, ajouter des boutons "Générer devis" et "Générer facture".
    *   [ ] Permettre le téléchargement et l'envoi par e-mail des documents.

---

### Phase 6 : Fonctionnalités Avancées et Suivi (Inchangé)

*   [ ] **6.1. Suivi par QR Code (pour les commandes)**
*   [ ] **6.2. Tableau de bord (KPI)**

---

### Phase 7 : Finalisation et Déploiement (Inchangé)

*   [ ] **7.1. Tests et débogage**
*   [ ] **7.2. Déploiement final**
