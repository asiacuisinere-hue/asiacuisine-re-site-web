# WebApp Development Plan - Asiacuisine.re

## Phase 1: Initial Setup & Environment Configuration (Completed)
*   [x] Setup GitHub repository for the dashboard.
*   [x] Choose and configure the hosting platform (Cloudflare Pages).
*   [x] Setup local development environment with Node.js and npm.
*   [x] Create initial React application structure using `create-react-app`.

## Phase 2: Database & Authentication (Completed)
*   [x] Setup Supabase project.
*   [x] Design database schema: `clients`, `demandes`, `abonnements`.
*   [x] Implement authentication for the admin dashboard using Supabase Auth.
*   [x] Create a secure login page.

## Phase 3: API Serverless Functions (Completed)
*   [x] Create a serverless function to retrieve new `demandes` from Supabase.
*   [x] Create a function to update the status of a `demande`.
*   [x] Create functions to manage `clients` (CRUD).
*   [x] Secure all API endpoints.

## Phase 4: Dashboard - Core Features (Completed)
*   [x] Create the main dashboard layout with a sidebar for navigation.
*   [x] Implement a view to display new `demandes` in a table or list.
*   [x] Allow the admin to view details of a `demande` in a modal or separate page.
*   [x] Allow the admin to change the status of a `demande` (e.g., "En cours", "Terminée").

## Phase 5: Client Management Interface (Completed)
*   [x] Create a page to list all clients (`particuliers` and `entreprises`).
*   [x] Implement functionality to add, view, edit, and delete clients.
*   [x] Display the history of `demandes` for each client.

## Phase 6: Invoicing and Quotes (Partially Completed)
*   [x] **6.1. Database Table for Documents:**
    *   [x] Create a `documents` table in Supabase to store invoices and quotes (id, demande_id, type, file_url, created_at).
*   [x] **6.2. PDF Generation Function:**
    *   [x] Create a serverless function (`generate-document`) that generates a PDF for a given `demande`.
    *   [x] The function should fetch client and demand details from Supabase.
    *   [x] The PDF should be professional and include all relevant details (client info, demand details, price, etc.).
*   [ ] **6.3. Invoicing Interface:**
    *   [x] In the `DemandeDetail` view, add "Create Quote" and "Create Invoice" buttons.
    *   [x] Clicking a button calls the `generate-document` function and allows the admin to download the PDF.
    *   [ ] Save the generated document to Supabase Storage and create an entry in the `documents` table.
    *   [ ] Add a feature to send the document directly to the client via email.

## Phase 7: Advanced Features & Tracking (In Progress)
*   [x] **7.1. QR Code Tracking (for Menu Orders):**
    *   [x] Generate a unique QR code for each menu order.
    *   [x] The QR code should link to a public tracking page (e.g., `asiacuisine.re/suivi?id=DEMANDE_ID`).
    *   [x] Create the simple public page that displays the order status.
    *   [x] Implement a QR code scanner in the dashboard to quickly find an order and update its status to "Delivered".
*   [ ] **7.2. Nutritional Calculator (on the main website):**
    *   [x] Create a new page `calculateur.html` on the main website.
    *   [x] Integrate an interactive tool for calculating daily calorie needs.
    *   [x] Add a link/CTA to the subscription plans.
*   [ ] **7.3. Subscription Management:**
    *   **Objectif:** Mettre en place un système complet pour gérer les abonnements, de la souscription à la gestion dans le dashboard.
    *   **7.3.1. Création de la table `abonnements` dans Supabase:**
        *   [ ] Définir une table pour stocker les informations des abonnés (`id`, `client_id`, `formule`, `status`, `date_debut`).
    *   **7.3.2. Formulaire de souscription:**
        *   [ ] Remplacer les liens `mailto:` de la page `abonnements.html` par un bouton ouvrant un formulaire de souscription.
    *   **7.3.3. Fonction serveur `create-subscription`:**
        *   [ ] Créer une fonction qui enregistre la demande dans Supabase et notifie l'administrateur par e-mail.
    *   **7.3.4. Intégration au Dashboard React:**
        *   [ ] Créer une page "Abonnements" listant tous les abonnés et leur statut.
        *   [ ] Permettre la gestion basique des abonnements (voir les détails, contacter, changer le statut).
        *   [ ] (Plus tard) Automatiser la génération des commandes hebdomadaires pour les abonnés actifs.

## Phase 8: Paramètres Avancés et Contenu Dynamique
*Objectif : Rendre le site administrable depuis le dashboard pour réduire le besoin de redéploiements.*

*   [ ] **8.1. Gestion du Calendrier :**
    *   [ ] Créer une table `indisponibilites` dans Supabase pour stocker les dates bloquées.
    *   [ ] Dans le dashboard, créer une page "Paramètres > Calendrier" avec une interface visuelle pour sélectionner/désélectionner des dates.
    *   [ ] Permettre de bloquer des jours de la semaine de manière récurrente (ex: tous les dimanches et lundis).
    *   [ ] Mettre à jour la fonction `/functions/disponibilites` pour qu'elle lise cette table et retourne la liste complète des jours non disponibles.

*   [ ] **8.2. Gestion des Menus Hebdomadaires :**
    *   [ ] Créer une table `menus_semaine` dans Supabase pour stocker les détails des formules (nom, prix, description, plats inclus).
    *   [ ] Dans le dashboard, créer une page "Paramètres > Menus" pour éditer ces formules.
    *   [ ] Modifier la page `menu.html` pour qu'elle charge dynamiquement les informations des formules depuis une nouvelle fonction serveur, au lieu d'être statique.

*   [ ] **8.3. Gestion du Popup d'Accueil :**
    *   [ ] Créer une table `contenu_dynamique` (ou utiliser une table de configuration générale) pour stocker le titre et le message du popup.
    *   [ ] Dans le dashboard, créer une section "Paramètres > Page d'accueil" avec des champs pour modifier le contenu du popup.
    *   [ ] Modifier le `script.js` du site principal pour récupérer ce contenu via une fonction serveur et l'afficher dans le popup.

*   [ ] **8.4. Gestion du Compte Administrateur :**
    *   [ ] Permettre à l'administrateur de changer son mot de passe directement depuis le dashboard.

## Phase 9: Finalization & Deployment
*   [ ] Thoroughly test all features.
*   [ ] Ensure the dashboard is fully responsive and works well on mobile devices.
*   [ ] Write documentation for setup and usage.
*   [ ] Final deployment and go-live.
