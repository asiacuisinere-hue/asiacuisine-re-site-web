# Suggestions d'Améliorations des Interactions Client (RESERVATION_SERVICE)

Ce document récapitule les suggestions d'amélioration des interactions client pour le service de Réservation de Chef Privé à Domicile (`RESERVATION_SERVICE`), organisées par phase. Un champ "Statut" est inclus pour faciliter le suivi des implémentations.

## 1. Amélioration de la Prise de Contact (Formulaire Initial)

**Objectif :** Obtenir des informations plus précises dès le départ pour réduire les échanges et qualifier la demande.

### 1.1. Ajouter un champ "Heure de l'événement"
*   **Description :** Intégrer un champ de sélection d'heure (plage horaire ou heure précise) au formulaire de réservation.
*   **Statut :** [x] Terminé

### 1.2. Champ structuré pour les "Allergies et Régimes Spéciaux"
*   **Description :** Remplacer le champ de message libre par des options structurées (cases à cocher, liste déroulante) et un champ texte complémentaire pour les détails.
*   **Statut :** [x] Terminé

### 1.3. Indication du Budget (Optionnel)
*   **Description :** Ajouter un champ optionnel (par exemple, liste déroulante avec des fourchettes de prix par personne) pour qualifier les attentes budgétaires du client.
*   **Statut :** [x] Terminé

## 2. Automatisation et Suivi de la Demande

**Objectif :** Rendre le client plus autonome et le tenir informé automatiquement.

### 2.1. Email de confirmation plus riche
*   **Description :** Enrichir l'email de confirmation client avec un numéro de demande unique et une indication du délai de réponse moyen.
*   **Statut :** [x] Terminé

### 2.2. Page de Suivi de Demande
*   **Description :** Créer une page dédiée où le client peut consulter le statut de sa demande en utilisant un identifiant unique ou son email.
*   **Statut :** [x] Terminé

## 3. Modernisation du Processus de Devis et de Paiement

**Objectif :** Accélérer la confirmation et la conversion.

### 3.1. Devis en Ligne Interactif
*   **Description :** Envoyer aux clients un lien vers un devis web interactif permettant l'approbation/refus direct et les commentaires, plutôt qu'un PDF statique.
*   **Statut :** [ ] Reporté (En attente du choix de la plateforme de paiement)

### 3.2. Intégration du Paiement en Ligne
*   **Description :** Permettre le paiement d'acomptes ou de la totalité de la prestation directement après l'approbation du devis via une passerelle de paiement intégrée.
*   **Statut :** [ ] Reporté (En attente du choix de la plateforme de paiement)

## 4. Communication Post-Réservation

**Objectif :** Professionnaliser l'expérience jusqu'au bout et fidéliser.

### 4.1. Email de Rappel Automatique (avant prestation)
*   **Description :** Envoyer un email de rappel automatique quelques jours avant la date de la prestation, récapitulant les détails.
*   **Statut :** [x] Terminé

### 4.2. Email Post-Prestation (demande d'avis)
*   **Description :** Envoyer un email de remerciement et une invitation à laisser un avis après la réalisation de la prestation.
*   **Statut :** [x] Terminé

## 5. Intégration du Menu Discuté au Processus de Devis

### 5.1. Ajout du champ "Détails du Menu Convenu"
*   **Description :** Intégrer un champ de texte libre dans le formulaire de création de devis pour saisir les détails du menu discuté avec le client. Ces détails seront stockés en base de données et affichés sur le PDF du devis.
*   **Statut :** [x] Terminé

## 6. Évolutions Futures (Vision à Long Terme)

### 6.1. Page de Création de Menu Préliminaire par le Client
*   **Description :** Créer une page privée, accessible via le numéro de suivi, où le client peut parcourir une galerie de plats "inspiration" et faire une présélection. Cette sélection servirait de base de discussion pour l'appel et pourrait pré-remplir le devis.
*   **Workflow :**
    1. Le client reçoit l'e-mail de confirmation avec un lien vers cette page.
    2. Il se connecte avec son ID et sélectionne des plats.
    3. Vous consultez ses choix avant de l'appeler pour finaliser.
*   **Statut :** [x] Terminé techniquement (En attente de contenu/photos par l'admin)

## 7. Améliorations du Tableau de Bord (Pilotage & Logistique)

**Objectif :** Transformer le Dashboard en un véritable assistant de production et de livraison.

### 7.1. Assistant "Liste de Courses" consolidée
*   **Description :** Ajouter un outil dans l'Atelier capable d'additionner automatiquement tous les articles des commandes "À préparer" pour une date donnée.
*   **Statut :** [x] Terminé

### 7.2. "Feuille de Route" Logistique (Export PDF/Vue Mobile)
*   **Description :** Créer un export regroupant les livraisons par Zone (Nord, Sud, etc.) avec adresses cliquables (Google Maps) et numéros de téléphone.
*   **Statut :** [ ] En cours

### 7.3. Vue "Calendrier de Production" (Planning Visuel)
*   **Description :** Remplacer ou compléter la vue en listes par un calendrier de type planning hebdomadaire avec des blocs de couleurs selon l'activité (Cuisine, Livraison, Prestation).
*   **Statut :** [ ] En attente

### 7.4. Historique et Préférences Client (CRM)
*   **Description :** Afficher dans la fiche détaillée les commandes passées du client et un champ "Notes de Fidélité" (ex: "N'aime pas la coriandre").
*   **Statut :** [ ] En attente

## 8. Expérience Mobile-First (Design Web-App)

**Objectif :** Transformer la page Menu en une interface fluide, proche d'une application native pour mobile.

### 8.1. Barre d'Action Collée en Bas (Sticky Bottom Bar)
*   **Description :** Placer une barre flottante au bas de l'écran affichant le total du panier et un bouton "Continuer" permanent.
*   **Statut :** [x] Terminé

### 8.2. Système de "Bottom Sheets"
*   **Description :** Utiliser des panneaux coulissants depuis le bas de l'écran pour les sélections d'options (A/B) ou les détails des plats.
*   **Statut :** [ ] En attente

### 8.3. Navigation par Étapes (Stepper)
*   **Description :** Diviser le processus de commande en 3 écrans fluides : 1) Formule, 2) Logistique (Date/Ville), 3) Coordonnées.
*   **Statut :** [x] Terminé

### 8.4. Carrousels de Plats Horizontaux
*   **Description :** Pour les offres spéciales, remplacer la liste verticale par un défilement horizontal des photos de plats.
*   **Statut :** [x] Terminé

## 9. Assistant Intelligent (Chatbot & Base de Connaissances)

**Objectif :** Automatiser les réponses aux questions fréquentes et décharger le Chef des demandes répétitives.

### 9.1. Chatbot basé sur une Base de Connaissances (RAG)
*   **Description :** Implémenter un chatbot capable de répondre aux questions sur les zones de livraison, les allergènes, les tarifs et le fonctionnement des abonnements en utilisant une base de connaissances stockée dans Supabase.
*   **Technologie :** Intégration de l'API Gemini 1.5 Flash avec recherche sémantique dans Supabase (pgvector).
*   **Protections :** Mise en place de limitations de débit (Rate Limiting), filtres de sécurité Google et cadrage strict par "System Prompt" pour éviter les détournements.
*   **Statut :** [ ] En attente (Validé sur le principe)

### 9.2. Gestionnaire de Base de Connaissances dans le Dashboard
*   **Description :** Créer une interface dans le tableau de bord permettant d'ajouter, modifier ou supprimer des articles de FAQ et de la documentation produit pour mettre à jour instantanément les connaissances du bot.
*   **Statut :** [ ] En attente

## 10. Gestion Financière et Rentabilité (Pilotage Chef)

**Objectif :** Offrir une vision claire du bénéfice réel après déduction de toutes les charges.

### 10.1. Simulateur de Revenu Net
*   **Description :** Implémenter un calculateur intégrant le CA brut, les cotisations URSSAF (taux marchandises vs services), les frais Stripe (1.5% + 0.25€) et les coûts variables (Food Cost, Livraison).
*   **Fonctionnalités :** 
    1. **Mode Réel** : Calcul basé sur les factures payées du mois.
    2. **Mode Simulation** : Utilisation de curseurs pour tester la rentabilité de futurs menus ou événements.
*   **Statut :** [ ] En attente (Validé sur le principe)
