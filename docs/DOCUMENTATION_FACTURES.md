# Documentation du Composant : Gestion des Factures

## 1. Vue d'ensemble

**Fichier :** `dashboard/src/pages/Factures.js`

Ce composant a pour rôle d'afficher et de gérer le cycle de vie des factures **uniquement** pour les demandes de type `RESERVATION_SERVICE`. Il permet de suivre les paiements, de lancer la préparation des demandes et de communiquer avec le client.

## 2. Récupération des Données (`fetchInvoices`)

La fonction `fetchInvoices` est le cœur de la logique d'affichage.

- **Source principale :** table `invoices`.
- **Données liées (JOINs) :** Elle récupère également les informations des tables `clients`, `entreprises` et `demandes` (notamment le `type` et le `status` de la demande).

### Logique de Filtrage

La liste des factures affichées est le résultat de plusieurs filtres cumulatifs :

1.  **Filtre principal (non modifiable) :**
    -   Affiche **uniquement** les factures liées à une `RESERVATION_SERVICE` en vérifiant que `quote_id` n'est pas `NULL`.

2.  **Filtre d'exclusion :**
    -   Exclut les factures dont la demande associée a déjà été envoyée en préparation ou terminée. Concrètement, elle n'affiche pas les factures si le statut de la demande (`demandes.status`) est l'un des suivants :
        - `'En attente de préparation'`
        - `'Préparation en cours'`
        - `'completed'`

3.  **Filtres utilisateur (dynamiques) :**
    -   **Recherche textuelle :** Filtre sur le numéro de facture, le nom/prénom du client ou le nom de l'entreprise.
    -   **Filtre par statut :** Le menu déroulant "Tous les statuts" permet de filtrer les factures par leur propre statut (`pending`, `deposit_paid`, `paid`, `cancelled`). Ce filtre est également synchronisé avec les paramètres de l'URL (ex: `/factures?status=paid`).

## 3. Flux de travail et Actions des Boutons (dans la modale `InvoiceDetailModal`)

L'essentiel de la logique métier se trouve dans les boutons de la modale "Détails Facture".

---

### Bouton : "Marquer comme Payée"
- **Condition d'affichage :** Visible si le statut de la facture est `"pending"` (En attente) ou `"deposit_paid"` (Acompte versé).
- **Action :** Met à jour le statut de la **facture** à `"paid"`.
- **Résultat attendu :**
    - La facture obtient le statut "Payée".
    - Le bouton "Marquer comme Payée" disparaît.
    - Le nouveau bouton **"Mettre en préparation"** apparaît.

---

### Bouton : "Mettre en préparation"
- **Condition d'affichage :** Visible si le statut de la facture est `"paid"` ET que le type de la demande liée est `RESERVATION_SERVICE`.
- **Action :** Met à jour le statut de la **demande** liée à `"En attente de préparation"`.
- **Résultat attendu :**
    - La demande apparaît maintenant dans la section "À Préparer".
    - La facture **disparaît** de la liste principale "Factures" (car notre filtre d'exclusion s'applique).
    - Le compteur du badge "Payées (Prêtes)" diminue, et celui de "À Préparer" augmente.

---

### Bouton : "Enregistrer un acompte"
- **Condition d'affichage :** Visible si le statut de la facture est `"pending"`.
- **Action :** Met à jour la facture avec le montant de l'acompte, la date et change son statut à `"deposit_paid"`.
- **Résultat attendu :** La facture passe de la vue "En attente" à la vue "Acompte versé".

---

### Bouton : "Annuler la facture"
- **Condition d'affichage :** Visible si le statut de la facture n'est pas déjà `"cancelled"`.
- **Action :** Met à jour le statut de la **facture** à `"cancelled"`.
- **Résultat attendu :** La facture apparaît dans la vue filtrée "Annulée".

---

### Bouton : "Envoyer par mail"
- **Condition d'affichage :** Toujours visible dans la modale.
- **Action :** Appelle la fonction serverless `send-invoice-by-email`, qui génère le PDF de la facture et l'envoie au client via Resend.
- **Résultat attendu :** Le client reçoit un e-mail avec la facture en pièce jointe.
