document.addEventListener('DOMContentLoaded', () => {

    // --- Base de données des recettes (valeurs pour 100g) ---
    const recipes = {
        'poulet-teriyaki': {
            name: 'Poulet Teriyaki',
            kcalPer100g: 150,
            proteinPer100g: 18,
            carbsPer100g: 8,
            fatPer100g: 5,
            pricePer100g: 2.50,
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSdUrpl-2PgvpK2pROZTOXHYQNDpwGoi1CYEbuQMlC8k2CHipZ-SlcIhrb2tp7yZwV_G967sVRLSsa2zKj5EsCFSM5Cz4Uu4J5ksCCAVKVEisk5WoBpi4bWJueUP9NgJfJb7LqKohUKxQY2rfmgWhEMbnggGDGGc15WMygDUubfMb3_QTK9TFvhyyccq00goMYj2A-YuajN6Yoe3OPLor_s2O8wZfSMZoOUwNUETdPpMyWKwpbq62QlThbufOnZiV4lvE8FCXv9H8'
        },
        'boeuf-loc-lac': {
            name: 'Boeuf Loc Lac',
            kcalPer100g: 180,
            proteinPer100g: 22,
            carbsPer100g: 7,
            fatPer100g: 8,
            pricePer100g: 3.00,
            image: 'URL_IMAGE_BOEUF' // À remplacer
        },
        'crevettes-satay': {
            name: 'Crevettes Satay',
            kcalPer100g: 130,
            proteinPer100g: 15,
            carbsPer100g: 6,
            fatPer100g: 5,
            pricePer100g: 2.80,
            image: 'URL_IMAGE_CREVETTES' // À remplacer
        }
    };

    // --- État de l'application ---
    let currentRecipeId = 'poulet-teriyaki';
    let targetCalories = 550; // Valeur par défaut

    // --- Éléments du DOM ---
    const recipeOptionsContainer = document.getElementById('recipe-options');
    const selectedRecipeNameEl = document.getElementById('selected-recipe-name');
    const calorieSlider = document.getElementById('calorie-slider');
    const calorieInput = document.getElementById('calorie-input');
    
    const caloriesValueEl = document.getElementById('calories-value');
    const proteinValueEl = document.getElementById('protein-value');
    const carbsValueEl = document.getElementById('carbs-value');
    const fatValueEl = document.getElementById('fat-value');
    const priceValueEl = document.getElementById('price-value');
    const weightValueEl = document.getElementById('weight-value'); // Nouvel élément pour le poids

    const requestButton = document.getElementById('request-button');
    const specialInstructionsEl = document.getElementById('special-instructions');

    // --- Fonctions ---

    function updateDisplay() {
        const recipe = recipes[currentRecipeId];
        if (!recipe) return;

        // Calculer le poids nécessaire pour atteindre l'objectif de calories
        const requiredWeight = (targetCalories / recipe.kcalPer100g) * 100;
        const ratio = requiredWeight / 100;

        const finalProtein = Math.round(recipe.proteinPer100g * ratio);
        const finalCarbs = Math.round(recipe.carbsPer100g * ratio);
        const finalFat = Math.round(recipe.fatPer100g * ratio);
        const finalPrice = (recipe.pricePer100g * ratio).toFixed(2);

        // Mettre à jour l'interface
        selectedRecipeNameEl.textContent = recipe.name;
        caloriesValueEl.textContent = targetCalories;
        proteinValueEl.textContent = `${finalProtein}g`;
        carbsValueEl.textContent = `${finalCarbs}g`;
        fatValueEl.textContent = `${finalFat}g`;
        priceValueEl.textContent = finalPrice;
        weightValueEl.textContent = `${Math.round(requiredWeight)}g`;
    }

    function renderRecipeOptions() {
        recipeOptionsContainer.innerHTML = '';
        Object.keys(recipes).forEach(recipeId => {
            const recipe = recipes[recipeId];
            const isChecked = recipeId === currentRecipeId;
            const labelClass = isChecked 
                ? 'flex items-center justify-between rounded-lg border border-primary bg-primary/10 p-3 dark:border-primary dark:bg-primary/20'
                : 'flex items-center justify-between rounded-lg border border-border-light bg-content-light p-3 dark:border-border-dark dark:bg-content-dark';

            const optionHtml = `
                <label class="${labelClass}">
                    <span class="font-medium text-text-light dark:text-text-dark">${recipe.name}</span>
                    <input type="radio" name="base-recipe" value="${recipeId}" ${isChecked ? 'checked' : ''} class="h-5 w-5 border-primary text-primary focus:ring-primary">
                </label>
            `;
            recipeOptionsContainer.innerHTML += optionHtml;
        });

        document.querySelectorAll('input[name="base-recipe"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                currentRecipeId = e.target.value;
                updateDisplay();
                renderRecipeOptions();
            });
        });
    }

    // --- Écouteurs d'événements ---

    calorieSlider.addEventListener('input', (e) => {
        targetCalories = parseInt(e.target.value, 10);
        calorieInput.value = targetCalories;
        updateDisplay();
    });

    calorieInput.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            targetCalories = value;
            calorieSlider.value = value;
            updateDisplay();
        }
    });

    requestButton.addEventListener('click', () => {
        const recipe = recipes[currentRecipeId];
        const finalValues = {
            recipe: recipe.name,
            calories: caloriesValueEl.textContent,
            protein: proteinValueEl.textContent,
            carbs: carbsValueEl.textContent,
            fat: fatValueEl.textContent,
            price: priceValueEl.textContent,
            weight: weightValueEl.textContent,
            specialInstructions: specialInstructionsEl.value
        };

        const subject = `Demande de devis pour un plat personnalisé : ${recipe.name}`;
        const body = `Bonjour,

Je serais intéressé(e) par un devis pour la configuration de plat suivante :

Recette de base : ${finalValues.recipe}
Objectif calorique : ~${finalValues.calories} kcal

--- Valeurs estimées ---
Poids : ~${finalValues.weight}
Protéines : ~${finalValues.protein}
Glucides : ~${finalValues.carbs}
Lipides : ~${finalValues.fat}
Prix : ${finalValues.price}€

--- Instructions spéciales ---
${finalValues.specialInstructions || 'Aucune'}

Merci de me recontacter pour finaliser ma demande.
`;
        window.location.href = `mailto:contact@asiacuisine.re?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    // --- Initialisation ---
    calorieInput.value = targetCalories;
    calorieSlider.value = targetCalories;
    renderRecipeOptions();
    updateDisplay();
});