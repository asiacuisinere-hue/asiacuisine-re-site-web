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
        const data = await response.json();
        const container = document.getElementById('announcement-container');
        const content = document.getElementById('announcement-content');
        if ((data.announcement_enabled === true || data.announcement_enabled === 'true') && data.announcement_message) {
            const style = announcementStyles[data.announcement_style] || announcementStyles.info;
            content.innerHTML = marked.parse(data.announcement_message);
            content.style.backgroundColor = style.background;
            content.style.borderLeft = `4px solid ${style.border}`;
            container.style.display = 'block';
        } else container.style.display = 'none';
    } catch (e) {}
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

    // --- NEW: SIMPLE & ROBUST WHATSAPP LINK ---
    function openWhatsAppLink(phone, message) {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message.trim())}`;
        window.location.assign(url); // More reliable than window.open on mobile browsers
    }

    function renderSpecialOffer(offer) {
        const container = document.getElementById('special-offer-container');
        if (!container) return;
        const dishOptions = offer.dishes.map((dish, index) => `<option value="${index}">${dish.name}</option>`).join('');
        container.innerHTML = `
            <h2>${offer.title || 'Offre Spéciale'}</h2>
            <div id="special-offer-creator" style="background: #f9f9f9; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <div class="form-grid" style="align-items: flex-end;">
                    <div class="form-group">
                        <label>Plat</label><select id="special-offer-dish" class="form-control">${dishOptions}</select>
                    </div>
                    <div class="form-group">
                        <label>Portion</label><select id="special-offer-portion" class="form-control"></select>
                    </div>
                    <div class="form-group">
                        <label>Qté</label><input type="number" id="special-offer-quantity" class="form-control" value="1" min="1">
                    </div>
                    <div class="form-group">
                        <button type="button" id="add-to-cart-btn" class="cta-button">Ajouter</button>
                    </div>
                </div>
            </div>
            <div id="special-offer-summary"></div>
        `;
        const updatePortions = (idx) => {
            const d = offer.dishes[idx];
            document.getElementById('special-offer-portion').innerHTML = `<option value="1">${d.label1}</option><option value="2">${d.label2}</option>`;
        };
        document.getElementById('special-offer-dish').addEventListener('change', (e) => updatePortions(e.target.value));
        updatePortions(0);
        document.getElementById('add-to-cart-btn').addEventListener('click', () => {
            const idx = document.getElementById('special-offer-dish').value;
            const port = document.getElementById('special-offer-portion').value;
            const q = parseInt(document.getElementById('special-offer-quantity').value);
            const d = offer.dishes[idx];
            cart.push({ name: d.name, portion: port === '1' ? d.label1 : d.label2, quantity: q, price: parseFloat(port === '1' ? d.price1 : d.price2) });
            renderCart();
        });
    }

    function renderCart() {
        const container = document.getElementById('special-offer-summary');
        if (!container) return;
        if (cart.length === 0) { container.innerHTML = ''; return; }
        let total = 0;
        const html = cart.map((item, i) => {
            total += item.quantity * item.price;
            return `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                <span>${item.quantity} x ${item.name}</span>
                <span>${(item.quantity * item.price).toFixed(2)}€ <button type="button" onclick="window.removeFromCart(${i})" style="color:red; background:none; border:none; cursor:pointer;">&times;</button></span>
            </div>`;
        }).join('');
        container.innerHTML = `<h3 style="margin-top:2rem;">Votre Panier</h3>${html}<div style="text-align:right; font-weight:bold; margin-top:1rem;">Total: ${total.toFixed(2)}€</div>`;
    }
    window.removeFromCart = (i) => { cart.splice(i, 1); renderCart(); };

    function renderCalendar(monthOffset = 0) {
        if (isOverrideEnabled) return;
        calendarContainer.innerHTML = '';
        const today = new Date(); today.setHours(0,0,0,0);
        const displayDate = new Date(); displayDate.setMonth(displayDate.getMonth() + monthOffset); displayDate.setDate(1);
        const month = displayDate.getMonth(); const year = displayDate.getFullYear();
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        
        // Allowed week window
        const allowedStart = new Date(today);
        if (today.getDay() === 0) allowedStart.setDate(today.getDate() + 1);
        else allowedStart.setDate(today.getDate() - (today.getDay() - 1));
        allowedStart.setHours(0,0,0,0);
        const allowedEnd = new Date(allowedStart); allowedEnd.setDate(allowedStart.getDate() + 5);

        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerHTML = `<button type="button" onclick="window.changeMonth(-1)">&lt;</button><h2>${monthNames[month]} ${year}</h2><button type="button" onclick="window.changeMonth(1)">&gt;</button>`;
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"].forEach(d => grid.innerHTML += `<div class="calendar-day-header">${d}</div>`);
        
        for (let i = 0; i < new Date(year, month, 1).getDay(); i++) grid.appendChild(document.createElement('div'));
        for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) {
            const d = new Date(year, month, i); d.setHours(0,0,0,0);
            const ds = `${String(i).padStart(2,'0')}/${String(month+1).padStart(2,'0')}/${year}`;
            const el = document.createElement('div'); el.className = 'calendar-day current-month'; el.textContent = i;
            let disabled = (d < allowedStart || d > allowedEnd || d.getDay() === 0 || unavailableDates.includes(ds));
            
            const cutoff = new Date(d); cutoff.setDate(d.getDate() - orderCutoffDays); cutoff.setHours(orderCutoffHour,0,0,0);
            if (new Date() > cutoff) disabled = true;

            if (disabled) el.classList.add('disabled');
            else {
                el.classList.add('available');
                el.addEventListener('click', () => { selectedDate = d; jourInput.value = ds; selectedDateDisplay.value = d.toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'}); renderCalendar(monthOffset); });
            }
            if (selectedDate && d.getTime() === selectedDate.getTime()) el.classList.add('selected');
            grid.appendChild(el);
        }
        calendarContainer.appendChild(header); calendarContainer.appendChild(grid);
    }
    window.changeMonth = (o) => { renderCalendar(o); };

    async function fetchMenuContent() {
        try {
            const response = await fetch('/get-menus');
            const data = await response.json();
            orderCutoffDays = data.order_cutoff_days || 2;
            orderCutoffHour = data.order_cutoff_hour || 11;
            
            if (data.menu_override_enabled === true || data.menu_override_enabled === 'true') {
                isOverrideEnabled = true;
                document.getElementById('menu-override-message').style.display = 'block';
                document.getElementById('menu-override-message').querySelector('p').innerHTML = marked.parse(data.menu_override_message);
                document.querySelectorAll('.weekly-menu-content, #formula-cards-container, #calendar-container, #whatsapp-button-container').forEach(e => e.style.display = 'none');
                return;
            }

            // Fill prices and content
            const fill = (id, val) => { if(document.getElementById(id)) document.getElementById(id).textContent = val; };
            fill('price-decouverte', `${data.menu_decouverte_price}€`);
            fill('price-standard', `${data.menu_standard_price}€`);
            fill('price-confort', `${data.menu_confort_price}€`);
            fill('price-duo', `${data.menu_duo_price}€`);
            
            if(data.special_offer_enabled === 'true') {
                specialOfferDetails = JSON.parse(data.special_offer_details);
                document.getElementById('special-offer-container').style.display = 'block';
                renderSpecialOffer(specialOfferDetails);
            }
            
            renderCalendar();
        } catch (e) {}
    }

    fetchAndDisplayAnnouncement();
    fetchMenuContent();

    cards.forEach(card => card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        card.querySelector('input[type="radio"]').checked = true;
    }));

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = form.querySelector('.cta-button');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.jour || !data.email) return alert('Veuillez remplir vos informations.');

        let orderPayload = {
            type: cart.length > 0 ? 'COMMANDE_SPECIALE' : 'COMMANDE_MENU',
            customer: { firstName: data.prenom, lastName: data.nom, phone: data.telephone, email: data.email },
            deliveryCity: data.livraison,
            requestDate: convertDateToISO(data.jour),
            customerType: 'Particulier'
        };

        if (cart.length > 0) {
            orderPayload.details = JSON.stringify(cart);
            orderPayload.total = cart.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        } else {
            if (!data.formule) return alert('Veuillez choisir une formule.');
            orderPayload.formulaName = data.formule;
            // Get selected sub-option if exists
            const opt = document.querySelector('input[name^="option"]:checked');
            orderPayload.formulaOption = opt ? opt.value : null;
        }

        submitBtn.textContent = 'Envoi...';
        submitBtn.disabled = true;

        try {
            const token = await grecaptcha.execute('6LcYThAsAAAAAOV055t1Nvd5Uo94kcTmPUBd-cmq', {action: 'submit'});
            orderPayload.recaptchaToken = token;

            // --- FIXED: USE ABSOLUTE PATH WITHOUT TRAILING SLASH ---
            const res = await fetch('/create-request', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(orderPayload) 
            });

            if (!res.ok) throw new Error('Erreur lors de la sauvegarde.');

            // Success: Open WhatsApp
            const waMessage = `Bonjour, intention de commande pour le ${data.jour} :\n- Client : ${data.nom}\n- Formule : ${data.formule || 'Spéciale'}`;
            openWhatsAppLink('33767644714', waMessage);
            
            form.reset();
            cards.forEach(c => c.classList.remove('selected'));
            cart = []; renderCart();

        } catch (error) {
            alert("Une erreur est survenue. Veuillez réessayer.");
            console.error(error);
        } finally {
            submitBtn.textContent = 'Valider ma commande';
            submitBtn.disabled = false;
        }
    });
});