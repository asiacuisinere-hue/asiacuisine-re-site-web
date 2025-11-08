document.addEventListener('DOMContentLoaded', () => {

    // --- Base de données des recettes ---
    const recipes = {
        'poulet-teriyaki': {
            name: 'Poulet Teriyaki',
            baseCalories: 550,
            baseProtein: 45,
            baseCarbs: 52,
            baseFat: 18,
            basePrice: 14.50,
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBSdUrpl-2PgvpK2pROZTOXHYQNDpwGoi1CYEbuQMlC8k2CHipZ-SlcIhrb2tp7yZwV_G967sVRLSsa2zKj5EsCFSM5Cz4Uu4J5ksCCAVKVEisk5WoBpi4bWJueUP9NgJfJb7LqKohUKxQY2rfmgWhEMbnggGDGGc15WMygDUubfMb3_QTK9TFvhyyccq00goMYj2A-YuajN6Yoe3OPLor_s2O8wZfSMZoOUwNUETdPpMyWKwpbq62QlThbufOnZiV4lvE8FCXv9H8'
        },
        'boeuf-loc-lac': {
            name: 'Boeuf Loc Lac',
            baseCalories: 620,
            baseProtein: 50,
            baseCarbs: 55,
            baseFat: 22,
            basePrice: 16.00,
            image: 'URL_IMAGE_BOEUF' // À remplacer
        },
        'crevettes-satay': {
            name: 'Crevettes Satay',
            baseCalories: 480,
            baseProtein: 40,
            baseCarbs: 45,
            baseFat: 15,
            basePrice: 15.50,
            image: 'URL_IMAGE_CREVETTES' // À remplacer
        }
    };

    // --- État de l'application ---
    let currentRecipeId = 'poulet-teriyaki';
    let proteinAdjustment = 0;
    let carbsAdjustment = 0;

    // --- Éléments du DOM ---
    const recipeOptionsContainer = document.getElementById('recipe-options');
    const selectedRecipeNameEl = document.getElementById('selected-recipe-name');
    const proteinSlider = document.getElementById('protein-slider');
    const carbsSlider = document.getElementById('carbs-slider');
    
    const caloriesValueEl = document.getElementById('calories-value');
    const proteinValueEl = document.getElementById('protein-value');
    const carbsValueEl = document.getElementById('carbs-value');
    const fatValueEl = document.getElementById('fat-value');
    const priceValueEl = document.getElementById('price-value');

    const requestButton = document.getElementById('request-button');

    // --- Fonctions ---

    function updateDisplay() {
        const recipe = recipes[currentRecipeId];
        if (!recipe) return;

        const proteinModifier = 1 + (proteinAdjustment / 100);
        const carbsModifier = 1 + (carbsAdjustment / 100);

        // Estimer l'impact des ajustements sur les calories
        const calorieAdjustment = (recipe.baseProtein * 4 * (proteinAdjustment / 100)) + (recipe.baseCarbs * 4 * (carbsAdjustment / 100));
        const finalCalories = Math.round(recipe.baseCalories + calorieAdjustment);

        const finalProtein = Math.round(recipe.baseProtein * proteinModifier);
        const finalCarbs = Math.round(recipe.baseCarbs * carbsModifier);
        const finalFat = Math.round(recipe.baseFat * proteinModifier); // Simplification
        const finalPrice = (recipe.basePrice * proteinModifier * carbsModifier).toFixed(2);

        // Mettre à jour l'interface
        selectedRecipeNameEl.textContent = recipe.name;
        caloriesValueEl.textContent = finalCalories;
        proteinValueEl.textContent = `${finalProtein}g`;
        carbsValueEl.textContent = `${finalCarbs}g`;
        fatValueEl.textContent = `${finalFat}g`;
        priceValueEl.textContent = finalPrice;
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
                proteinSlider.value = 0;
                carbsSlider.value = 0;
                proteinAdjustment = 0;
                carbsAdjustment = 0;
                updateDisplay();
                renderRecipeOptions();
            });
        });
    }

    // --- Écouteurs d'événements ---

    proteinSlider.addEventListener('input', (e) => {
        proteinAdjustment = parseInt(e.target.value, 10);
        updateDisplay();
    });

    carbsSlider.addEventListener('input', (e) => {
        carbsAdjustment = parseInt(e.target.value, 10);
        updateDisplay();
    });

    requestButton.addEventListener('click', () => {
        window.location.href = 'abonnements.html';
    });

    // --- Initialisation ---
    renderRecipeOptions();
    updateDisplay();
});
