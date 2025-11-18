document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('whatsapp-order-form');
    const cards = document.querySelectorAll('.formula-card');
    const selectedDateDisplay = document.getElementById('selected-date-display');
    const jourInput = document.getElementById('jour');
    const calendarContainer = document.getElementById('calendar-container');

    let unavailableDates = [];
    let selectedDate = null;

    // Helper function to convert DD/MM/YYYY to YYYY-MM-DD for API submission
    function convertDateToISO(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return dateString; // Return original if format is unexpected
    }

    // Fetch unavailable dates from Netlify function
    async function fetchUnavailableDates() {
        try {
            const response = await fetch('/disponibilites');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            unavailableDates = data || []; // Data is already DD/MM/YYYY array
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
            // Format date for comparison with unavailableDates (DD/MM/YYYY)
            const dateStringDDMMYYYY = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
            const dayOfWeek = date.getDay();
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day current-month';
            dayElement.textContent = i;
            
            let isDisabled = false;

            // Disable past dates
            if (date < today) {
                isDisabled = true;
            }

            // Disable non-Wednesday, Friday, Saturday (0=Sun, 1=Mon, ..., 6=Sat)
            if (dayOfWeek !== 3 && dayOfWeek !== 5 && dayOfWeek !== 6) {
                isDisabled = true;
            }

            // Disable dates from API
            if (unavailableDates.includes(dateStringDDMMYYYY)) {
                isDisabled = true;
            }

            // Calculate cut-off time for 48-hour advance booking before 11 AM
            const cutOffDate = new Date(date);
            cutOffDate.setDate(date.getDate() - 2); // 2 days before delivery date
            cutOffDate.setHours(11, 0, 0, 0); // Set to 11 AM

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
                    jourInput.value = dateStringDDMMYYYY; // Store in DD/MM/YYYY
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

    // Fetch and display menu content or override message
    async function fetchMenuContent() {
        try {
            const response = await fetch('/get-menus');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (data.menu_override_enabled === 'true' && data.menu_override_message) {
                // Display override message and hide the form
                const menuContainer = document.getElementById('weekly-menu-content');
                const orderForm = document.getElementById('whatsapp-order-form');
                if (menuContainer && orderForm) {
                    menuContainer.innerHTML = `<h2>Information importante</h2><p>${data.menu_override_message}</p>`;
                    orderForm.style.display = 'none';
                }
            } else {
                // Populate menu content
                document.getElementById('content-decouverte').textContent = data.menu_decouverte || '';
                document.getElementById('content-standard').textContent = data.menu_standard || '';
                document.getElementById('content-confort').textContent = data.menu_confort || '';
                document.getElementById('content-duo').textContent = data.menu_duo || '';
            }
        } catch (error) {
            console.error('Error fetching menu content:', error);
        }
    }

    // Initial calls
    fetchUnavailableDates();
    fetchMenuContent();

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