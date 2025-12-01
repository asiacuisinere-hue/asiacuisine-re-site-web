// Styles pour les annonces
const announcementStyles = {
    info: { background: '#e3f2fd', border: '#2196f3' },
    attention: { background: '#fff9e6', border: '#ff9800' },
    fete: { background: '#ffebee', border: '#e91e63' },
    promotion: { background: '#fffaf0', border: '#d4af37' },
    annonce: { background: '#f3e5f5', border: '#9c27b0' }
};

async function fetchAndDisplayAnnouncement() {
    try {
        const response = await fetch('/get-announcement');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const announcementContainer = document.getElementById('announcement-container');
        const announcementContent = document.getElementById('announcement-content');

        if (data.announcement_enabled === 'true' && data.announcement_message) {
            const htmlContent = marked.parse(data.announcement_message);
            const style = announcementStyles[data.announcement_style] || announcementStyles.info;
            announcementContent.innerHTML = htmlContent;
            announcementContent.style.padding = '1.5rem';
            announcementContent.style.background = style.background;
            announcementContent.style.borderLeft = `4px solid ${style.border}`;
            announcementContent.style.borderRadius = '4px';
            announcementContainer.style.display = 'block';
        } else {
            announcementContainer.style.display = 'none';
        }
    } catch (error) {
        console.error('Error fetching announcement:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('whatsapp-order-form');
    const cards = document.querySelectorAll('.formula-card');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const jourInput = document.getElementById('jour');
    const calendarContainer = document.getElementById('calendar-container');

    let unavailableDates = [];
    let selectedDate = null;
    let isOverrideEnabled = false;
    let orderCutoffDays = 2;
    let orderCutoffHour = 11;
    let isSpecialOfferActive = false;
    let specialOfferDetails = null;
    let cart = [];

    function convertDateToISO(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
    }
    
    function renderSpecialOffer(offer) {
        const container = document.getElementById('special-offer-container');
        if (!container) return;

        const dishOptions = offer.dishes.map((dish, index) => 
            `<option value="${index}">${dish.name}</option>`
        ).join('');

        container.innerHTML = `
            <h2>${offer.title || 'Offre Spéciale'}</h2>
            <p class="subtitle">${offer.description || ''}</p>
            
            <div id="special-offer-creator" style="background: #f9f9f9; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <div class="form-grid" style="align-items: flex-end;">
                    <div class="form-group">
                        <label for="special-offer-dish">Plat</label>
                        <select id="special-offer-dish" class="form-control">${dishOptions}</select>
                    </div>
                    <div class="form-group">
                        <label for="special-offer-portion">Portion</label>
                        <select id="special-offer-portion" class="form-control">
                            <option value="250">250g</option>
                            <option value="500">500g</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="special-offer-quantity">Quantité</label>
                        <input type="number" id="special-offer-quantity" class="form-control" value="1" min="1" style="width: 80px;">
                    </div>
                    <div class="form-group">
                        <button type="button" id="add-to-cart-btn" class="cta-button" style="padding: 10px 15px; font-size: 14px;">Ajouter</button>
                    </div>
                </div>
            </div>

            <div id="special-offer-summary">
                {/* Cart items will be rendered here */}
            </div>
        `;

        document.getElementById('add-to-cart-btn').addEventListener('click', handleAddToCart);
    }

    function handleAddToCart() {
        const dishIndex = document.getElementById('special-offer-dish').value;
        const portion = document.getElementById('special-offer-portion').value;
        const quantity = parseInt(document.getElementById('special-offer-quantity').value, 10);
        
        if (!dishIndex || !portion || !quantity || quantity < 1) {
            alert('Veuillez sélectionner un plat, une portion et une quantité valide.');
            return;
        }

        const dish = specialOfferDetails.dishes[dishIndex];
        const price = portion === '250' ? dish.price250 : dish.price500;
        
        cart.push({
            name: dish.name,
            portion: `${portion}g`,
            quantity: quantity,
            price: parseFloat(price)
        });

        renderCart();
    }

    function renderCart() {
        const summaryContainer = document.getElementById('special-offer-summary');
        if (!summaryContainer) return;

        if (cart.length === 0) {
            summaryContainer.innerHTML = '';
            return;
        }

        let total = 0;
        const itemsHTML = cart.map((item, index) => {
            const itemTotal = item.quantity * item.price;
            total += itemTotal;
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                    <span>${item.quantity} x ${item.name} (${item.portion})</span>
                    <span style="display: flex; align-items: center;">
                        <span style="margin-right: 20px;">${itemTotal.toFixed(2)} €</span>
                        <button type="button" class="remove-from-cart-btn" data-index="${index}" style="background: #ff4d4d; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer;">&times;</button>
                    </span>
                </div>
            `;
        }).join('');

        summaryContainer.innerHTML = `
            <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Votre Commande Spéciale</h3>
            ${itemsHTML}
            <div style="text-align: right; font-size: 1.2rem; font-weight: bold; margin-top: 1rem;">
                Total: ${total.toFixed(2)} €
            </div>
        `;

        document.querySelectorAll('.remove-from-cart-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index, 10);
                cart.splice(index, 1);
                renderCart();
            });
        });
    }

    async function fetchUnavailableDates() {
        try {
            const response = await fetch('/disponibilites?service_type=COMMANDE_MENU');
            if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
            unavailableDates = await response.json() || [];
            if (!isOverrideEnabled) renderCalendar();
        } catch (error) {
            console.error('Error fetching unavailable dates:', error);
            if (!isOverrideEnabled) renderCalendar();
        }
    }

    function renderCalendar(monthOffset = 0) {
        if (isOverrideEnabled) return;

        calendarContainer.innerHTML = '';
        const calendarDiv = document.createElement('div');
        calendarDiv.className = 'calendar';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const displayDate = new Date();
        displayDate.setMonth(displayDate.getMonth() + monthOffset);
        displayDate.setDate(1);
        const month = displayDate.getMonth();
        const year = displayDate.getFullYear();
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
        
        const calendarHeaderDiv = document.createElement('div');
        calendarHeaderDiv.className = 'calendar-header';
        const prevMonthButton = document.createElement('button');
        prevMonthButton.id = 'prevMonth';
        prevMonthButton.innerHTML = '&lt;';
        prevMonthButton.addEventListener('click', () => renderCalendar(monthOffset - 1));
        const monthYearH2 = document.createElement('h2');
        monthYearH2.textContent = `${monthNames[month]} ${year}`;
        const nextMonthButton = document.createElement('button');
        nextMonthButton.id = 'nextMonth';
        nextMonthButton.innerHTML = '&gt;';
        nextMonthButton.addEventListener('click', () => renderCalendar(monthOffset + 1));
        calendarHeaderDiv.appendChild(prevMonthButton);
        calendarHeaderDiv.appendChild(monthYearH2);
        calendarHeaderDiv.appendChild(nextMonthButton);
        calendarDiv.appendChild(calendarHeaderDiv);

        const calendarGrid = document.createElement('div');
        calendarGrid.className = 'calendar-grid';
        dayNames.forEach(day => {
            const dayHeader = document.createElement('div');
            dayHeader.className = 'calendar-day-header';
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < firstDayOfMonth; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            date.setHours(0, 0, 0, 0);
            const dateStringDDMMYYYY = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day current-month';
            dayElement.textContent = i;
            
            let isDisabled = false;

            if (date < today) {
                isDisabled = true;
            }

            if (unavailableDates.includes(dateStringDDMMYYYY)) {
                isDisabled = true;
            }

            const cutOffDate = new Date(date);
            cutOffDate.setDate(date.getDate() - orderCutoffDays);
            cutOffDate.setHours(orderCutoffHour, 0, 0, 0);

            const now = new Date();
            if (now > cutOffDate) {
                isDisabled = true;
            }

            if (isDisabled) {
                dayElement.classList.add('disabled');
            } else {
                dayElement.classList.add('available');
                dayElement.addEventListener('click', () => {
                    selectedDate = date;
                    jourInput.value = dateStringDDMMYYYY;
                    selectedDateDisplay.value = formatDateForDisplay(date);
                    renderCalendar(monthOffset);
                });
            }
            if (selectedDate && dateStringDDMMYYYY === `${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()}`) {
                dayElement.classList.add('selected');
            }
            if (dateStringDDMMYYYY === `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`) {
                dayElement.classList.add('today');
            }
            calendarGrid.appendChild(dayElement);
        }
        calendarDiv.appendChild(calendarGrid);
        calendarContainer.appendChild(calendarDiv);
    }

    function formatDateForDisplay(date) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('fr-FR', options);
    }

    async function fetchMenuContent() {
        try {
            const response = await fetch('/get-menus');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            orderCutoffDays = data.order_cutoff_days || 2;
            orderCutoffHour = data.order_cutoff_hour || 11;

            const menuOverrideMessage = document.getElementById('menu-override-message');
            const formulaCardsContainer = document.getElementById('formula-cards-container');
            const whatsappButtonContainer = document.getElementById('whatsapp-button-container');
            const weeklyMenuContent = document.getElementById('weekly-menu-content');
            const infoSection = document.querySelector('.info-section');
            const specialOfferContainer = document.getElementById('special-offer-container');

            const disableRegularContent = (disable) => {
                const display = disable ? 'none' : '';
                if (weeklyMenuContent) weeklyMenuContent.style.display = display;
                if (formulaCardsContainer) formulaCardsContainer.style.display = display;
            };
            
            isSpecialOfferActive = data.special_offer_enabled === 'true' && data.special_offer_details;

            if (isSpecialOfferActive) {
                try {
                    specialOfferDetails = JSON.parse(data.special_offer_details);
                } catch (e) {
                    console.error("Failed to parse special offer details:", e);
                    isSpecialOfferActive = false; // Fallback to normal
                }
            }

            if (isSpecialOfferActive) {
                disableRegularContent(data.special_offer_disables_formulas === 'true');
                if (menuOverrideMessage) menuOverrideMessage.style.display = 'none';
                if (specialOfferContainer) {
                    specialOfferContainer.style.display = 'block';
                    renderSpecialOffer(specialOfferDetails);
                }
                fetchUnavailableDates();
            } else if (data.menu_override_enabled === 'true' && data.menu_override_message) {
                isOverrideEnabled = true;
                if (menuOverrideMessage) {
                    menuOverrideMessage.querySelector('p').textContent = data.menu_override_message;
                    menuOverrideMessage.style.display = 'block';
                }
                disableRegularContent(true);
                if (whatsappButtonContainer) whatsappButtonContainer.style.display = 'none';
                if (infoSection) infoSection.style.display = 'none';
                if (calendarContainer) calendarContainer.style.display = 'none';
                if (form) {
                    form.style.pointerEvents = 'none';
                    form.style.opacity = '0.5';
                }
            } else {
                isOverrideEnabled = false;
                if (menuOverrideMessage) menuOverrideMessage.style.display = 'none';
                if (specialOfferContainer) specialOfferContainer.style.display = 'none';
                
                disableRegularContent(false);

                if (whatsappButtonContainer) whatsappButtonContainer.style.display = '';
                if (infoSection) infoSection.style.display = '';
                if (calendarContainer) calendarContainer.style.display = '';
                if (form) {
                    form.style.pointerEvents = '';
                    form.style.opacity = '';
                }

                // Remplir le contenu des menus
                const contentDecouverte = document.getElementById('content-decouverte');
                if (contentDecouverte) {
                    if (data.menu_decouverte && data.menu_decouverte.trim()) {
                        contentDecouverte.innerHTML = `<strong>Formule Découverte :</strong> ${data.menu_decouverte}`;
                        contentDecouverte.style.display = '';
                    } else {
                        contentDecouverte.style.display = 'none';
                    }
                }
                const contentStandard = document.getElementById('content-standard');
                if (contentStandard) {
                    if (data.menu_standard && data.menu_standard.trim()) {
                        contentStandard.innerHTML = `<strong>Formule Standard :</strong> ${data.menu_standard}`;
                        contentStandard.style.display = '';
                    } else {
                        contentStandard.style.display = 'none';
                    }
                }
                const contentConfort = document.getElementById('content-confort');
                if (contentConfort) {
                    if (data.menu_confort && data.menu_confort.trim()) {
                        contentConfort.innerHTML = `<strong>Formule Confort :</strong> ${data.menu_confort}`;
                        contentConfort.style.display = '';
                    } else {
                        contentConfort.style.display = 'none';
                    }
                }
                const contentDuo = document.getElementById('content-duo');
                if (contentDuo) {
                    if (data.menu_duo && data.menu_duo.trim()) {
                        contentDuo.innerHTML = `<strong>Option Duo :</strong> ${data.menu_duo}`;
                        contentDuo.style.display = '';
                    } else {
                        contentDuo.style.display = 'none';
                    }
                }

                // Mettre à jour les prix
                if (data.menu_decouverte_price) {
                    document.getElementById('price-decouverte').textContent = `${data.menu_decouverte_price} €`;
                    document.getElementById('formule-decouverte').value = `Formule Découverte (${data.menu_decouverte_price}€)`;
                }
                if (data.menu_standard_price) {
                    document.getElementById('price-standard').textContent = `${data.menu_standard_price} €`;
                    document.getElementById('formule-standard').value = `Formule Standard (${data.menu_standard_price}€)`;
                }
                if (data.menu_confort_price) {
                    document.getElementById('price-confort').textContent = `${data.menu_confort_price} €`;
                    document.getElementById('formule-confort').value = `Formule Confort (${data.menu_confort_price}€)`;
                }
                if (data.menu_duo_price) {
                    document.getElementById('price-duo').textContent = `${data.menu_duo_price} €`;
                    document.getElementById('formule-duo').value = `Option Duo (${data.menu_duo_price}€)`;
                }

                fetchUnavailableDates();
            }
        } catch (error) {
            console.error('Error fetching menu content:', error);
        }
    }

    fetchAndDisplayAnnouncement();
    fetchMenuContent();

    cards.forEach(card => {
        card.addEventListener('click', () => {
            if (isOverrideEnabled || isSpecialOfferActive) return;
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            card.querySelector('input[type="radio"]').checked = true;
        });
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        if (isOverrideEnabled) {
            alert('Les commandes sont temporairement suspendues. Veuillez consulter le message affiché.');
            return;
        }

        const submitBtn = form.querySelector('.cta-button');
        const originalText = submitBtn.textContent;

        if (typeof grecaptcha === 'undefined') {
            alert('Erreur de configuration de la sécurité. Veuillez rafraîchir la page.');
            return;
        }
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.jour || !data.email) {
            alert('Veuillez remplir vos informations et la date de livraison/retrait.');
            return;
        }

        let message;
        let orderPayload;

        if (isSpecialOfferActive) {
            if (cart.length === 0) {
                alert('Votre panier est vide. Veuillez ajouter des plats pour commander.');
                return;
            }
            let total = 0;
            const orderDetails = cart.map(item => {
                const itemTotal = item.quantity * item.price;
                total += itemTotal;
                return `- ${item.quantity} x ${item.name} (${item.portion}) : ${itemTotal.toFixed(2)} €`;
            }).join('\n');
            
            message = `Bonjour, je souhaite passer une commande pour l'offre spéciale "${specialOfferDetails.title}" :\n\n${orderDetails}\n\nTotal : ${total.toFixed(2)} €\n\n- Nom : ${data.nom} ${data.prenom || ''}\n- Téléphone : ${data.telephone}\n- Livraison/Retrait : ${data.livraison}, le ${data.jour}\n\nMerci !\n`;
            
            orderPayload = {
                type: 'COMMANDE_SPECIALE',
                details: JSON.stringify(cart),
                total: total.toFixed(2),
                customer: { firstName: data.prenom, lastName: data.nom, phone: data.telephone, email: data.email },
                deliveryCity: data.livraison,
                requestDate: convertDateToISO(data.jour),
                recaptchaToken: null
            };

        } else {
            if (!data.formule) {
                alert('Veuillez choisir une formule.');
                return;
            }
            
            let formulaOption = null;
            if (data.formule.includes("Formule Standard")) {
                const selectedOptionStandard = document.querySelector('input[name="optionStandard"]:checked');
                if (!selectedOptionStandard) {
                    alert('Veuillez choisir une option (A ou B) pour la Formule Standard.');
                    return;
                }
                formulaOption = selectedOptionStandard.value;
            } else if (data.formule.includes("Formule Confort")) {
                const selectedOptionConfort = document.querySelector('input[name="optionConfort"]:checked');
                if (!selectedOptionConfort) {
                    alert('Veuillez choisir une option (A ou B) pour la Formule Confort.');
                    return;
                }
                formulaOption = selectedOptionConfort.value;
            } else if (data.formule.includes("Option Duo")) {
                const selectedOptionDuo = document.querySelector('input[name="optionDuo"]:checked');
                if (!selectedOptionDuo) {
                    alert("Veuillez choisir une option (A ou B) pour l'Option Duo.");
                    return;
                }
                formulaOption = selectedOptionDuo.value;
            }
            
            const formuleDetails = data.formule + (formulaOption ? ` (${formulaOption})` : '');
            message = `Bonjour, je souhaite passer une commande :\n\n- Formule : ${formuleDetails}\n- Nom : ${data.nom} ${data.prenom || ''}\n- Téléphone : ${data.telephone}\n- Livraison/Retrait : ${data.livraison}, le ${data.jour}\n\nMerci !\n`;

            orderPayload = {
                type: 'COMMANDE_MENU',
                customerType: 'Particulier',
                formulaName: data.formule,
                formulaOption: formulaOption,
                customer: { firstName: data.prenom, lastName: data.nom, phone: data.telephone, email: data.email },
                deliveryCity: data.livraison,
                requestDate: convertDateToISO(data.jour),
                recaptchaToken: null
            };
        }

        submitBtn.textContent = 'Vérification...';
        submitBtn.disabled = true;

        grecaptcha.ready(function() {
            grecaptcha.execute('6LcYThAsAAAAAOV055t1Nvd5Uo94kcTmPUBd-cmq', {action: 'submit'}).then(async function(recaptchaToken) {
                orderPayload.recaptchaToken = recaptchaToken;
                
                submitBtn.textContent = 'Envoi en cours...';

                try {
                    const response = await fetch('/create-request/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderPayload)
                    });
                    if (!response.ok) {
                        const errorResult = await response.json();
                        throw new Error(errorResult.error || 'Une erreur serveur est survenue.');
                    }

                    const whatsappUrl = `https://wa.me/33767644714?text=${encodeURIComponent(message.trim())}`;
                    window.open(whatsappUrl, '_blank');
                    form.reset();
                    cards.forEach(c => c.classList.remove('selected'));
                    cart = [];
                    renderCart();
                } catch (error) {
                    console.error('Erreur lors de la soumission:', error);
                    alert(`Une erreur est survenue : ${error.message}`);
                } finally {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            });
        });
    });
});
