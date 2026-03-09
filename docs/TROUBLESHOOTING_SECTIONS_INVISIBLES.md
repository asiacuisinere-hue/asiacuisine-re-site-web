# Diagnostic : Sections Invisibles ("Mon Parcours", "Réservation")

Ce problème est récurrent sur le projet. Voici les causes identifiées et les solutions à appliquer systématiquement.

## 🚨 Symptôme
Les sections du site (notamment "Mon Parcours", "Réservation", "Galerie") sont présentes dans le code HTML mais **ne s'affichent pas** à l'écran (elles restent vides ou invisibles).

## 🔍 Causes Racines Connues

### 1. Politique de Sécurité (CSP) Trop Stricte (Cause la plus fréquente)
*   **Le problème :** Le fichier `_headers` définit une `Content-Security-Policy` qui bloque le chargement de scripts externes essentiels comme `i18next` (traductions) ou `Swiper` (carrousel).
*   **Conséquence :** Le script JS plante au démarrage (`ReferenceError: i18next is not defined`). L'animation d'apparition (`.fade-in` -> `.visible`) ne se lance jamais. Les éléments restent à `opacity: 0`.
*   **Solution :** Vérifier la console du navigateur (F12). Si vous voyez `Refused to load script...`, ajoutez le domaine bloqué (ex: `unpkg.com`, `cdn.jsdelivr.net`) à la directive `script-src` dans `_headers`.

### 2. Erreur de Syntaxe JavaScript
*   **Le problème :** Une erreur de syntaxe (même minime, comme une accolade manquante ou un caractère invisible à la fin du fichier) dans `script.js` arrête l'exécution de tout le code.
*   **Conséquence :** La fonction `initializeScrollBasedEffects()` n'est jamais appelée.
*   **Solution :** Vérifier la fin du fichier `script.js`. S'assurer qu'il n'y a pas de code tronqué ou de caractères parasites (ex: issus d'un copier-coller PowerShell raté).

### 3. Structure HTML Brisée
*   **Le problème :** Une balise `</div>` manquante ou en trop dans une section précédente (souvent "Services" ou "À propos").
*   **Conséquence :** Le navigateur ne parvient pas à construire le DOM correctement. Les sections suivantes se retrouvent imbriquées dans la précédente ou masquées.
*   **Solution :** Compter les balises `<section>` et vérifier que chaque `.container` est bien fermé.

### 4. Problème de Déploiement (Dossier `dist/`)
*   **Le problème :** Les fichiers corrigés (`_headers`, `script.js`) sont à la racine mais n'ont pas été copiés dans le dossier de déploiement `dist/`.
*   **Conséquence :** Le site en ligne utilise toujours l'ancienne version buggée.
*   **Solution :** Toujours exécuter le script de build ou copier manuellement les fichiers modifiés dans `dist/` avant de déployer.

---

## ✅ Checklist de Résolution

1.  **Ouvrir la Console (F12)** : Y a-t-il des erreurs rouges ?
    *   *CSP Error* -> Modifier `_headers`.
    *   *Syntax Error* -> Corriger `script.js`.
2.  **Vérifier `script.js`** : La fin du fichier est-elle propre ?
3.  **Vérifier `_headers`** : Contient-il `unpkg.com` et `cdn.jsdelivr.net` ?
4.  **Vérifier le dossier `dist/`** : Les fichiers `_headers` et `script.js` dans `dist/` sont-ils identiques à ceux de la racine ?
