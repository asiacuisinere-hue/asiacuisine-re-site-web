### Spécification pour l'intégration de l'API de commande

Bonjour,

Afin de connecter le formulaire de commande de la page "menu" du site `asiacuisine.re` à l'application externe, nous devons définir une interface de programmation (API). Le site enverra les données de chaque nouvelle commande à un endpoint que vous nous fournirez.

#### 1. Endpoint

Veuillez nous fournir l'URL de l'endpoint qui recevra les données de la commande.

*   **Méthode HTTP :** `POST`
*   **URL de l'endpoint :** `https://api.votre-app.com/v1/orders` (Exemple à remplacer par votre URL)

#### 2. Authentification

La requête devra être authentifiée pour des raisons de sécurité. Nous recommandons l'utilisation d'une clé API que vous nous fournirez. Cette clé sera envoyée dans un en-tête HTTP.

*   **En-tête :** `Authorization`
*   **Valeur :** `Bearer VOTRE_CLE_API`

Cette clé sera stockée de manière sécurisée côté serveur dans les variables d'environnement du site.

#### 3. Format des données (Payload)

Les données de la commande seront envoyées au format `JSON` dans le corps (body) de la requête `POST`. Voici la structure proposée :

```json
{
  "formulaName": "Formule Standard (49€)",
  "formulaOption": "Option A",
  "customer": {
    "firstName": "Jean",
    "lastName": "Dupont",
    "phone": "0612345678"
  },
  "delivery": {
    "city": "Saint-Denis",
    "date": "2025-11-21"
  }
}
```

#### 4. Description des champs

| Champ | Type | Requis ? | Description |
| :--- | :--- | :--- | :--- |
| `formulaName` | string | Oui | Le nom de la formule choisie. Valeurs possibles : "Formule Découverte (39€)", "Formule Standard (49€)", "Formule Confort (59€)", "Option Duo (94€)". |
| `formulaOption`| string | Non | L'option A ou B, si applicable. Envoyé uniquement pour "Formule Standard" et "Option Duo". |
| `customer.firstName`| string | Oui | Le prénom du client. |
| `customer.lastName`| string | Oui | Le nom de famille du client. |
| `customer.phone`| string | Oui | Le numéro de téléphone du client. |
| `delivery.city`| string | Oui | La ville de livraison choisie dans la liste. |
| `delivery.date`| string | Oui | La date de livraison au format `AAAA-MM-JJ`. |

#### 5. Réponses attendues de l'API

*   **En cas de succès :** L'API devrait répondre avec un code de statut `201 Created` et peut retourner l'objet de la commande créée.
*   **En cas d'erreur de validation :** L'API devrait répondre avec un code `400 Bad Request` et un message d'erreur en JSON.
*   **En cas d'erreur serveur :** L'API devrait répondre avec un code `500 Internal Server Error`.

---

En résumé, pour commencer l'intégration, le développeur externe doit vous fournir :
1.  **L'URL de l'endpoint** de son API.
2.  **La clé d'API** (`API Key`) pour l'authentification.
