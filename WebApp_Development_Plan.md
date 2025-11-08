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
    *   [ ] Integrate an interactive tool for calculating daily calorie needs.
    *   [ ] Add a link/CTA to the subscription plans.
*   [ ] **7.3. Subscription Management:**
    *   [ ] Create an interface to manage client subscriptions (`abonnements`).
    *   [ ] Allow admins to view, pause, or cancel a subscription.
    *   [ ] Automatically generate recurring weekly `demandes` for active subscriptions.

## Phase 8: Settings & Configuration
*   [ ] Create a settings page in the dashboard.
*   [ ] Allow the admin to manage service availability (e.g., holidays, unavailable dates).
*   [ ] Manage email notification templates.
*   [ ] Allow the admin to change their password.

## Phase 9: Finalization & Deployment
*   [ ] Thoroughly test all features.
*   [ ] Ensure the dashboard is fully responsive and works well on mobile devices.
*   [ ] Write documentation for setup and usage.
*   [ ] Final deployment and go-live.
