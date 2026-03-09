# Idées d'Évolutions pour le Site Asiacuisine.re

Ce fichier récapitule les opportunités de croissance et d'amélioration technique pour la plateforme.

---

### [ ] 1. Galerie Photo Dynamique avec Instagram
*   **Idée :** Remplacer la galerie statique par un flux Instagram en direct.
*   **Complexité :** Élevée (API Facebook Graph).
*   **Status :** À l'étude.

---

### [ ] 2. Carte Interactive des Cuisines Asiatiques
*   **Idée :** Carte SVG de l'Asie avec photos de plats au survol.
*   **Complexité :** Élevée.
*   **Status :** En attente de ressources graphiques.

---

### [ ] 3. Utilisation de GIFs pour un Contenu Dynamique
*   **Idée :** Remplacer la photo du Chef par un GIF de préparation culinaire.
*   **Complexité :** Faible.
*   **Status :** Nécessite les fichiers médias.

---

### [ ] 4. Système de Témoignages Semi-Automatique
*   **Idée :** Formulaire de dépôt d'avis avec modération dans le dashboard.
*   **Complexité :** Moyenne.
*   **Status :** À planifier.

---

### [/] 5. Page Dédiée aux Services pour Professionnels (B2B)
*   **Idée :** Créer `professionnels.html` pour les dîners d'affaires et séminaires.
*   **Mise en œuvre :** Option "Repas d'affaires" déjà ajoutée au formulaire.
*   **Status :** **Partiellement fait** (Formulaire OK, Page dédiée à créer).

---

### [x] 6. Mini-CRM pour la Gestion des Clients et Réservations
*   **Idée :** Dashboard de gestion complet avec historique et documents.
*   **Réalisation :** Interface `gestion.asiacuisine.re` opérationnelle avec Supabase.
*   **Status :** **Terminé**.

---

### [ ] 7. Mode Maintenance (Cloudflare)
*   **Idée :** Page d'attente lors des grosses mises à jour.
*   **Technique :** Utiliser les **Cloudflare Workers** ou les **Bulk Redirects** (anciennement `vercel.json`).
*   **Status :** À documenter pour Cloudflare.

---

### [ ] 8. Menu Interactif Avancé (Philosophie Culinaire)
*   **Idée :** Système de commande basé sur le partage et la personnalisation en temps réel.
*   **Status :** R&D en cours.

---

### [x] 9. Notifications Push (WebPush) pour l'Équipe
*   **Idée :** Alertes mobiles instantanées pour les nouvelles commandes.
*   **Réalisation :** Service Worker et table `push_subscriptions` actifs.
*   **Status :** **Terminé**.

---

### [ ] 10. Notifications Push Client pour la Livraison
*   **Idée :** Envoyer une notification automatique au client ("Je suis en route !") lorsqu'on active le tracker GPS.
*   **Avantage :** Améliore drastiquement l'expérience client.
*   **Status :** **Nouveau** (Techniquement prêt, nécessite le lien commande <-> appareil).

---

### [/] 11. Offres Consulting & Freelance (Hôtels / Restaurants)
*   **Idée :** Proposer des prestations contractuelles (création de carte, renfort brigade) aux pros du secteur.
*   **Avantage :** Fort levier de crédibilité et revenus B2B stables.
*   **Status :** **Nouveau** (Option ajoutée au formulaire, à mettre en avant sur le site).

---

### [ ] 12. Transformation du Dashboard en SaaS (ChefOS)
*   **Idée :** Proposer votre interface de gestion à d'autres chefs via un abonnement.
*   **Défis :** Isolation des données (Multi-tenancy) et intégration de Stripe.
*   **Points importants:** Modification du nommage devis et factures ainsi que l'implémentation de logo
*   **Status :** **Vision Long Terme**.
