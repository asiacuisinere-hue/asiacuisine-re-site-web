document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('whatsapp-order-form');
    const cards = document.querySelectorAll('.formula-card');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const jourInput = document.getElementById('jour');
    const calendarContainer = document.getElementById('calendar-container');

    let unavailableDates = [];
    let selectedDate = null;
    let isOverrideEnabled = false;
    let orderCutoffDays = 2; // Default, will be updated from backend
    let orderCutoffHour = 11; // Default, will be updated from backend

    function convertDateToISO(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
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

            // Set cutoff values from fetched data
            orderCutoffDays = data.order_cutoff_days || 2;
            orderCutoffHour = data.order_cutoff_hour || 11;

            // --- DEBUG LOG ---
            console.log(`DEBUG: Délai de ${orderCutoffDays} jours, Heure limite ${orderCutoffHour}h`);

            const menuOverrideMessage = document.getElementById('menu-override-message');
            const formulaCardsContainer = document.getElementById('formula-cards-container');
            const whatsappButtonContainer = document.getElementById('whatsapp-button-container');
            const weeklyMenuContent = document.getElementById('weekly-menu-content');
            const infoSection = document.querySelector('.info-section');

            if (data.menu_override_enabled === 'true' && data.menu_override_message) {
                isOverrideEnabled = true;
                if (menuOverrideMessage) {
                    menuOverrideMessage.querySelector('p').textContent = data.menu_override_message;
                    menuOverrideMessage.style.display = 'block';
                }
                if (weeklyMenuContent) weeklyMenuContent.style.display = 'none';
                if (formulaCardsContainer) formulaCardsContainer.style.display = 'none';
                if (whatsappButtonContainer) whatsappButtonContainer.style.display = 'none';
                if (infoSection) infoSection.style.display = 'none';
                if (calendarContainer) calendarContainer.style.display = 'none';
                if (form) {
                    form.style.pointerEvents = 'none';
                    form.style.opacity = '0.5';
                }
                cards.forEach(card => {
                    card.style.pointerEvents = 'none';
                    card.style.opacity = '0.5';
                });
            } else {
                isOverrideEnabled = false;
                if (menuOverrideMessage) {
                    menuOverrideMessage.style.display = 'none';
                }
                if (weeklyMenuContent) weeklyMenuContent.style.display = '';
                if (formulaCardsContainer) formulaCardsContainer.style.display = '';
                if (whatsappButtonContainer) whatsappButtonContainer.style.display = '';
                if (infoSection) infoSection.style.display = '';
                if (calendarContainer) calendarContainer.style.display = '';
                if (form) {
                    form.style.pointerEvents = '';
                    form.style.opacity = '';
                }
                cards.forEach(card => {
                    card.style.pointerEvents = '';
                    card.style.opacity = '';
                });

                // Remplir le contenu des menus
                const contentDecouverte = document.getElementById('content-decouverte');
                const contentStandard = document.getElementById('content-standard');
                const contentConfort = document.getElementById('content-confort');
                const contentDuo = document.getElementById('content-duo');

                if (contentDecouverte && data.menu_decouverte) {
                    contentDecouverte.innerHTML = `<strong>Formule Découverte :</strong> ${data.menu_decouverte}`;
                }
                if (contentStandard && data.menu_standard) {
                    contentStandard.innerHTML = `<strong>Formule Standard :</strong> ${data.menu_standard}`;
                }
                if (contentConfort && data.menu_confort) {
                    contentConfort.innerHTML = `<strong>Formule Confort :</strong> ${data.menu_confort}`;
                }
                if (contentDuo && data.menu_duo) {
                    contentDuo.innerHTML = `<strong>Option Duo :</strong> ${data.menu_duo}`;
                }

                fetchUnavailableDates();
            }
        } catch (error) {
            console.error('Error fetching menu content:', error);
        }
    }

    fetchMenuContent();

    // Gestionnaire de clic pour les cartes (seulement si non override)
    cards.forEach(card => {
        card.addEventListener('click', () => {
            if (isOverrideEnabled) return;
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            card.querySelector('input[type="radio"]').checked = true;
        });
    });

    // Gestionnaire de soumission du formulaire
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

        submitBtn.textContent = 'Vérification...';
        submitBtn.disabled = true;

        grecaptcha.ready(function() {
            grecaptcha.execute('6LcYThAsAAAAAOV055t1Nvd5Uo94kcTmPUBd-cmq', {action: 'submit'}).then(async function(recaptchaToken) {
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());

                if (!data.formule || !data.jour || !data.email) {
                    alert('Veuillez remplir tous les champs obligatoires.');
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                    return;
                }

                let formulaOption = null;
                if (data.formule.includes("Formule Standard")) {
                    const selectedOptionStandard = document.querySelector('input[name="optionStandard"]:checked');
                    if (!selectedOptionStandard) {
                        alert('Veuillez choisir une option (A ou B) pour la Formule Standard.');
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                        return;
                    }
                    formulaOption = selectedOptionStandard.value;
                } else if (data.formule.includes("Formule Confort")) {
                    const selectedOptionConfort = document.querySelector('input[name="optionConfort"]:checked');
                    if (!selectedOptionConfort) {
                        alert('Veuillez choisir une option (A ou B) pour la Formule Confort.');
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                        return;
                    }
                    formulaOption = selectedOptionConfort.value;
                } else if (data.formule.includes("Option Duo")) {
                    const selectedOptionDuo = document.querySelector('input[name="optionDuo"]:checked');
                    if (!selectedOptionDuo) {
                        alert("Veuillez choisir une option (A ou B) pour l'Option Duo.");
                        submitBtn.textContent = originalText;
                        submitBtn.disabled = false;
                        return;
                    }
                    formulaOption = selectedOptionDuo.value;
                }

                const orderData = {
                    type: 'COMMANDE_MENU',
                    customerType: 'Particulier',
                    formulaName: data.formule,
                    formulaOption: formulaOption,
                    customer: { firstName: data.prenom, lastName: data.nom, phone: data.telephone, email: data.email },
                    deliveryCity: data.livraison,
                    requestDate: convertDateToISO(data.jour),
                    recaptchaToken: recaptchaToken
                };

                submitBtn.textContent = 'Envoi en cours...';

                try {
                    const response = await fetch('/create-request/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(orderData)
                    });
                    if (!response.ok) {
                        const errorResult = await response.json();
                        throw new Error(errorResult.error || 'Une erreur serveur est survenue.');
                    }

                    const formuleDetails = data.formule + (formulaOption ? ` (${formulaOption})` : '');
                    const message = `\nBonjour, je souhaite passer une commande :\n\n- Formule : ${formuleDetails}\n- Nom : ${data.nom} ${data.prenom || ''}\n- Téléphone : ${data.telephone}\n- Livraison/Retrait : ${data.livraison}, le ${data.jour}\n\nMerci !\n`;
                    const whatsappUrl = `https://wa.me/33767644714?text=${encodeURIComponent(message.trim())}`;
                    window.open(whatsappUrl, '_blank');
                    form.reset();
                    cards.forEach(c => c.classList.remove('selected'));
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
