document.addEventListener('DOMContentLoaded', async () => {
    const authSection = document.getElementById('auth-section');
    const menuSection = document.getElementById('menu-section');
    const requestIdInput = document.getElementById('request-id-input');
    const authBtn = document.getElementById('auth-btn');
    const dishesGrid = document.getElementById('dishes-grid');
    const selectionBar = document.getElementById('selection-bar');
    const selectionCountEl = document.getElementById('selection-count');
    const validateBtn = document.getElementById('validate-selection-btn');
    
    let allDishes = [];
    let selectedDishes = [];
    let currentRequestId = '';
    let currentFilters = { country: 'All', ingredient: 'All' };

    // 1. Vérification automatique via URL (ex: choix-menu.html?id=041c6d64)
    const urlParams = new URLSearchParams(window.location.search);
    const idParam = urlParams.get('id');
    if (idParam && idParam.length === 8) {
        requestIdInput.value = idParam;
        startApp(idParam);
    }

    authBtn.addEventListener('click', () => {
        const id = requestIdInput.value.trim();
        if (id.length === 8) startApp(id);
        else alert('Veuillez entrer un ID de suivi valide (8 caractères).');
    });

    async function startApp(id) {
        currentRequestId = id;
        authSection.style.display = 'none';
        menuSection.style.display = 'block';
        await fetchDishes();
        renderFilters();
        renderDishes();
    }

    async function fetchDishes() {
        try {
            const response = await fetch('/api/get-dishes');
            allDishes = await response.json();
        } catch (error) {
            console.error('Erreur chargement plats:', error);
            dishesGrid.innerHTML = '<p>Erreur lors du chargement des plats. Veuillez réessayer.</p>';
        }
    }

    function renderFilters() {
        const countries = ['All', ...new Set(allDishes.map(d => d.country).filter(Boolean))];
        const ingredients = ['All', ...new Set(allDishes.map(d => d.main_ingredient).filter(Boolean))];

        const countryContainer = document.getElementById('country-filters');
        countryContainer.innerHTML = countries.map(c => 
            `<button class="filter-btn ${currentFilters.country === c ? 'active' : ''}" data-type="country" data-value="${c}">${c === 'All' ? 'Tous les pays' : c}</button>`
        ).join('');

        const ingredientContainer = document.getElementById('ingredient-filters');
        ingredientContainer.innerHTML = ingredients.map(i => 
            `<button class="filter-btn ${currentFilters.ingredient === i ? 'active' : ''}" data-type="ingredient" data-value="${i}">${i === 'All' ? 'Tous les ingrédients' : i}</button>`
        ).join('');

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { type, value } = e.target.dataset;
                currentFilters[type] = value;
                renderFilters();
                renderDishes();
            });
        });
    }

    function renderDishes() {
        const filtered = allDishes.filter(d => {
            const countryMatch = currentFilters.country === 'All' || d.country === currentFilters.country;
            const ingredientMatch = currentFilters.ingredient === 'All' || d.main_ingredient === currentFilters.ingredient;
            return countryMatch && ingredientMatch;
        });

        dishesGrid.innerHTML = filtered.map(dish => {
            const isSelected = selectedDishes.some(sd => sd.id === dish.id);
            return `
                <div class="dish-card ${isSelected ? 'selected' : ''}" data-id="${dish.id}">
                    <img src="${dish.image_url || 'https://via.placeholder.com/300x200?text=Asiacuisine.re'}" alt="${dish.name}" class="dish-image">
                    <div class="dish-info">
                        <h3 class="dish-name">${dish.name}</h3>
                        <div class="dish-tags">
                            <span class="tag">${dish.country}</span>
                            <span class="tag">${dish.main_ingredient}</span>
                            <span class="tag">${dish.cooking_type}</span>
                        </div>
                        <p style="font-size: 0.9rem; color: #666; margin-bottom: 15px;">${dish.description || ''}</p>
                        <button class="select-btn ${isSelected ? 'btn-remove' : 'btn-add'}">
                            ${isSelected ? 'Retirer' : 'Ajouter à ma sélection'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Listeners pour les boutons de sélection
        document.querySelectorAll('.select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.dish-card');
                const dishId = card.dataset.id;
                toggleDishSelection(dishId);
            });
        });
    }

    function toggleDishSelection(id) {
        const dish = allDishes.find(d => d.id === id);
        const index = selectedDishes.findIndex(sd => sd.id === id);

        if (index > -1) selectedDishes.splice(index, 1);
        else selectedDishes.push(dish);

        updateSelectionBar();
        renderDishes();
    }

    function updateSelectionBar() {
        selectionCountEl.textContent = selectedDishes.length;
        if (selectedDishes.length > 0) selectionBar.classList.add('visible');
        else selectionBar.classList.remove('visible');
    }

    // --- Logique de la Modal ---
    const modal = document.getElementById('service-modal');
    const serviceOptions = document.querySelectorAll('.service-option');
    const finalSubmitBtn = document.getElementById('final-submit-btn');
    let selectedStyle = '';

    validateBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    serviceOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            serviceOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedStyle = opt.dataset.style;
            finalSubmitBtn.disabled = false;
        });
    });

    finalSubmitBtn.addEventListener('click', async () => {
        finalSubmitBtn.disabled = true;
        finalSubmitBtn.textContent = 'Envoi en cours...';

        try {
            const response = await fetch('/api/save-menu-selection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    demandId: currentRequestId,
                    selectedDishes: selectedDishes.map(d => ({ id: d.id, name: d.name })),
                    serviceStyle: selectedStyle
                })
            });

            if (response.ok) {
                alert('Votre sélection a été transmise au Chef avec succès ! Nous vous contacterons bientôt pour finaliser.');
                window.location.href = `suivi.html?id=${currentRequestId}`;
            } else {
                throw new Error('Erreur lors de la sauvegarde');
            }
        } catch (error) {
            alert('Une erreur est survenue. Veuillez réessayer.');
            finalSubmitBtn.disabled = false;
            finalSubmitBtn.textContent = 'Envoyer ma sélection au Chef';
        }
    });

    document.getElementById('close-modal-btn').addEventListener('click', () => {
        modal.style.display = 'none';
    });
});
