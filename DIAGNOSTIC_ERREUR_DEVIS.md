# Diagnostic et Solution : Erreur 405 sur l'API de Devis

## Description du Problème

Lors de la tentative de génération d'un devis depuis l'application de tableau de bord (`gestion.asiacuisine.re`), l'application a reçu une erreur `405 Method Not Allowed` lors de l'appel à l'endpoint `/api/create-quote`.

Le log d'erreur spécifique était :
`POST https://gestion.asiacuisine.re/api/create-quote 405 (Method Not Allowed)`

## Origine de l'Erreur

Le problème provenait d'un appel API utilisant une URL relative (`/api/create-quote`) depuis le frontend de l'application tableau de bord (`dashboard/src/pages/Devis.js`).

Étant donné que le tableau de bord est déployé sur le sous-domaine `gestion.asiacuisine.re`, un appel avec une URL relative est résolu par le navigateur comme `https://gestion.asiacuisine.re/api/create-quote`.

Cependant, la fonction serverless (`functions/api/create-quote.js`) qui gère la création de devis est déployée avec le site principal, `asiacuisine.re`. Le serveur hébergeant `gestion.asiacuisine.re` (qui sert uniquement l'application React statique) ne connaît pas cet endpoint API et ne gère pas les requêtes `POST` pour ce chemin, d'où l'erreur `405 Method Not Allowed`.

## Solution Appliquée

La solution a consisté à modifier le fichier `dashboard/src/pages/Devis.js` pour que l'appel `fetch` utilise l'URL absolue de l'API.

-   **Fichier modifié** : `dashboard/src/pages/Devis.js`
-   **Ancienne ligne (simplifiée)** :
    ```javascript
    const response = await fetch('/api/create-quote', { /* ... */ });
    ```
-   **Nouvelle ligne (corrigée)** :
    ```javascript
    const response = await fetch('https://asiacuisine.re/api/create-quote', { /* ... */ });
    ```
Cette modification garantit que la requête API est désormais dirigée vers le bon domaine (`asiacuisine.re`) où la fonction serverless est correctement déployée et opérationnelle.

## Étapes Suivantes pour la Mise en Production

Pour que la correction prenne effet sur votre environnement de production :

1.  **Commitez** la modification du fichier `dashboard/src/pages/Devis.js` dans votre dépôt Git.
2.  **Redéployez** l'application du tableau de bord sur Cloudflare Pages.

## Recommandation pour l'Avenir (Bonne Pratique)

Pour une meilleure maintenabilité et flexibilité, il est fortement recommandé d'utiliser une **variable d'environnement** pour définir l'URL de base de l'API dans votre application React (tableau de bord). Cela permet d'adapter facilement l'URL de l'API en fonction de l'environnement de déploiement (développement local, staging, production) sans avoir à modifier le code source.

Exemple d'utilisation de variable d'environnement dans un projet React :

1.  **Définir la variable d'environnement** (par exemple, dans un fichier `.env` ou via les paramètres de déploiement Cloudflare Pages du tableau de bord) :
    ```
    REACT_APP_API_BASE_URL=https://asiacuisine.re
    ```
2.  **Utiliser la variable dans le code** (`dashboard/src/pages/Devis.js`) :
    ```javascript
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://default-api.com'; // Fallback for dev
    // ...
    const response = await fetch(`${API_BASE_URL}/api/create-quote', { /* ... */ });
    ```
Cette approche rendra votre application plus robuste et plus facile à gérer à long terme.
