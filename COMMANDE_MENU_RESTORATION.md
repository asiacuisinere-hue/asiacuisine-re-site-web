# Restauration du Flux "COMMANDE_MENU"

Ce document suit les étapes de restauration des fonctionnalités manquantes pour le traitement des demandes de type "COMMANDE_MENU".

## Problème Initial
La simplification du composant `DemandeDetail.js` et de la fonction `generate-document.js` a entraîné la perte de la logique métier complexe pour les "COMMANDE_MENU", notamment :
- L'envoi automatique de la facture par email après génération.
- Le changement de statut de la demande après envoi de la facture.
- La gestion du paiement et l'envoi du QR code.
- La gestion de la date de livraison et du statut "Préparation en cours".
- La validation finale via QR code.

## Objectif Général
Restaurer le flux complet de traitement d'une "COMMANDE_MENU" tel que décrit par l'utilisateur, en séparant les responsabilités entre les fonctions backend et les composants frontend.

## Plan de Restauration Détaillé

### Étape 1 : Génération et Envoi de la Facture (avec Mise à Jour du Statut)
- **Description:** Modifier le bouton "Générer Facture" dans la modale `DemandeDetail` pour qu'il déclenche un flux complet.
- **Actions:**
    1.  Créer une fonction backend dédiée (ou adapter une existante) pour :
        *   Générer le PDF de la facture.
        *   Envoyer ce PDF par e-mail au client.
        *   Mettre à jour le statut de la demande à `'En attente de paiement'`.
    2.  Modifier le composant `DemandeDetail.js` pour appeler cette fonction backend et gérer la réponse.
- **Statut:** COMPLETED

### Étape 2 : Gestion du Paiement et Envoi du QR Code
- **Description:** Ajouter les actions nécessaires une fois que la demande est passée au statut `'En attente de paiement'`.
- **Actions:**
    1.  Ajouter un bouton "Paiement reçu" dans la modale `DemandeDetail` (visible pour les demandes `'En attente de paiement'`).
    2.  Cliquer sur ce bouton appellera une fonction backend pour :
        *   Mettre à jour le statut de la demande à `'En attente de préparation'`.
        *   Appeler la fonction backend `send-qrcode.js` pour envoyer le QR code au client.
    3.  Modifier le composant `DemandeDetail.js` pour afficher ce bouton et gérer son action.
- **Statut:** COMPLETED

### Étape 3 : Flux de Livraison
- **Description:** Gérer les actions liées à la préparation et la livraison le jour J.
- **Actions:**
    1.  Ajouter une colonne (ou champ éditable) pour la date de livraison dans la modale `DemandeDetail` (si elle n'est pas déjà présente et persévérante). - **COMPLETED**
    2.  Ajouter un bouton "Mettre en préparation" (visible le jour de la livraison ou avant). - **COMPLETED**
    3.  Ce bouton changera le statut de la demande à `'Préparation en cours'`. - **COMPLETED**
    4.  Implémenter la logique pour le scan/confirmation du QR code. - **COMPLETED (Redirection & Validation page)**
    5.  Mettre à jour le statut à `'Confirmée'` / `'Completed'` (après scan QR code) et la déplacer vers l'historique.
- **Statut:** PENDING

### Étape 4 : Affichage des Informations Complémentaires
- **Description:** S'assurer que toutes les informations pertinentes sont correctement affichées dans la modale `DemandeDetail`.
- **Actions:**
    1.  Vérifier l'affichage de la date de livraison, du nombre de personnes, des détails de livraison (si pertinents pour `COMMANDE_MENU`) dans la modale.
    2.  Ajuster le `renderReadOnlyDetails` si nécessaire.
- **Statut:** COMPLETED

---

**Statuts des demandes pertinents :**
- `En attente de traitement` (initial)
- `En attente de paiement` (après envoi facture)
- `En attente de préparation` (après paiement)
- `Préparation en cours` (le jour J)
- `Confirmée` / `Completed` (après scan QR code)
- `Annulée`
