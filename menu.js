document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('whatsapp-order-form');
    const cards = document.querySelectorAll('.formula-card');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const jourInput = document.getElementById('jour');
    const calendarContainer = document.getElementById('calendar-container');

    let unavailableDates = [];
    let selectedDate = null;

    // Fetch unavailable dates from Netlify function
    async function fetchUnavailableDates() {
        try {
            const response = await fetch('/disponibilites');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            unavailableDates = data.unavailableDates || [];
            renderCalendar();
        } catch (error) {
            console.error('Error fetching unavailable dates:', error);
            // Fallback: render calendar without unavailable dates if API fails
            renderCalendar();
        }
    }

    // Calendar rendering logic
    function renderCalendar(monthOffset = 0) {
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
            const dateString = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day current-month';
            dayElement.textContent = i;
            let isDisabled = date < today || (dayOfWeek !== 3 && dayOfWeek !== 5 && dayOfWeek !== 6) || unavailableDates.includes(dateString);
            const cutOffDate = new Date(date);
            cutOffDate.setDate(date.getDate() - 2);
            cutOffDate.setHours(11, 0, 0, 0);
            if (new Date() > cutOffDate) isDisabled = true;

            if (isDisabled) {
                dayElement.classList.add('disabled');
            } else {
                dayElement.classList.add('available');
                dayElement.addEventListener('click', () => {
                    selectedDate = date;
                    jourInput.value = dateString;
                    selectedDateDisplay.value = formatDateForDisplay(date);
                    renderCalendar(monthOffset);
                });
            }
            if (selectedDate && dateString === selectedDate.toISOString().split('T')[0]) {
                dayElement.classList.add('selected');
            }
            if (dateString === today.toISOString().split('T')[0]) {
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

    fetchUnavailableDates();

    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            card.querySelector('input[type="radio"]').checked = true;
        });
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
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
                    requestDate: convertDateToISO(data.jour), // Convert date format
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
