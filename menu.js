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
    let specialOfferDetails = null;
    let cart = [];

    // Helper for i18next
    const t = (key) => typeof i18next !== 'undefined' ? i18next.t(key) : key;

    function convertDateToISO(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
    }

    function openWhatsAppLink(phone, message) {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message.trim())}`;
        window.location.assign(url);
    }

    function renderSpecialOffer(offer) {
        const container = document.getElementById('special-offer-container');
        if (!container) return;
        
        const dishOptions = offer.dishes.map((dish, index) => {
            const minPrice = Math.min(parseFloat(dish.price1) || 999, parseFloat(dish.price2) || 999);
            return `<option value="${index}">${dish.name} (${t('menu.from_price')} ${minPrice.toFixed(2)}€)</option>`;
        }).join('');

        container.innerHTML = `
            <h2>${offer.title || t('menu.special_offer_title')}</h2>
            <div id="special-offer-creator" style="background: #f9f9f9; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
                <div class="form-grid" style="align-items: flex-end;">
                    <div class="form-group">
                        <label>${t('menu.special_offer_dish')}</label><select id="special-offer-dish" class="form-control">${dishOptions}</select>
                    </div>
                    <div class="form-group">
                        <label>${t('menu.special_offer_portion')} & ${t('menu.label_price')}</label><select id="special-offer-portion" class="form-control"></select>
                    </div>
                    <div class="form-group">
                        <label>${t('menu.special_offer_quantity')}</label><input type="number" id="special-offer-quantity" class="form-control" value="1" min="1">
                    </div>
                    <div class="form-group">
                        <button type="button" id="add-to-cart-btn" class="cta-button">${t('menu.special_offer_add')}</button>    
                    </div>
                </div>
            </div>
            <div id="special-offer-summary"></div>
        `;

        const updatePortions = (idx) => {
            const d = offer.dishes[idx];
            document.getElementById('special-offer-portion').innerHTML = `
                <option value="1">${d.label1} - ${parseFloat(d.price1).toFixed(2)}€</option>
                <option value="2">${d.label2} - ${parseFloat(d.price2).toFixed(2)}€</option>
            `;
        };

        document.getElementById('special-offer-dish').addEventListener('change', (e) => updatePortions(e.target.value));
        updatePortions(0);

        document.getElementById('add-to-cart-btn').addEventListener('click', () => {
            const idx = document.getElementById('special-offer-dish').value;
            const port = document.getElementById('special-offer-portion').value;
            const q = parseInt(document.getElementById('special-offer-quantity').value);
            const d = offer.dishes[idx];
            cart.push({ 
                name: d.name, 
                portion: port === '1' ? d.label1 : d.label2, 
                quantity: q, 
                price: parseFloat(port === '1' ? d.price1 : d.price2) 
            });
            renderCart();
        });
    }

    function renderCart() {
        const container = document.getElementById('special-offer-summary');
        if (!container) return;
        if (cart.length === 0) { container.innerHTML = ''; return; }

        let subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        
        const selectedMode = form.querySelector('input[name="deliveryMode"]:checked')?.value || 'retrait';
        const isDelivery = selectedMode === 'livraison';
        
        const zoneSelect = document.getElementById('delivery-zone-special');
        let deliveryFee = isDelivery && zoneSelect ? parseFloat(zoneSelect.value) : 0;
        
        let zoneName = "";
        if (isDelivery && zoneSelect) {
            zoneName = zoneSelect.options[zoneSelect.selectedIndex].text.split('(')[0].trim();
        } else {
            zoneName = t('menu.retrait_label') + " (Gratuit)";
        }

        const itemsHtml = cart.map((item, i) => {
            return `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                <span>${item.quantity} x ${item.name} (${item.portion})</span>
                <span>${(item.quantity * item.price).toFixed(2)}€ <button type="button" onclick="window.removeFromCart(${i})" style="color:red; background:none; border:none; cursor:pointer;">&times;</button></span>
            </div>`;
        }).join('');

        const total = subtotal + deliveryFee;

        container.innerHTML = `
            <div style="background: #fffdf5; border: 2px solid #d4af37; border-radius: 20px; padding: 2rem; margin-top: 2rem; box-shadow: 0 10px 30px rgba(212, 175, 55, 0.1);">
                <h3 style="margin-top:0; text-align: left !important; color: #1a1a1a;">${t('menu.cart_title')}</h3>
                <div style="margin-bottom: 1.5rem;">
                    ${itemsHtml}
                </div>

                <div style="border-top: 2px dashed #d4af37; padding-top: 1.5rem; margin-bottom: 1.5rem;">
                    <p style="font-weight: 900; font-size: 0.9rem; margin-bottom: 1rem; text-transform: uppercase; color: #d4af37;">${t('menu.reception_mode_title')}</p>
                    <div class="delivery-options" style="margin-bottom: 1rem;">
                        <label class="delivery-type-label">
                            <input type="radio" name="deliveryMode" value="retrait" ${!isDelivery ? 'checked' : ''} onchange="window.updateSpecialDelivery()">
                            <div class="delivery-box">
                                <div class="delivery-icon">📍</div>
                                <div>
                                    <p class="delivery-title" style="text-align:left">${t('menu.retrait_label')}</p>
                                    <p class="delivery-desc">Gratuit</p>
                                </div>
                            </div>
                        </label>
                        <label class="delivery-type-label">
                            <input type="radio" name="deliveryMode" value="livraison" ${isDelivery ? 'checked' : ''} onchange="window.updateSpecialDelivery()">
                            <div class="delivery-box">
                                <div class="delivery-icon">🚚</div>
                                <div>
                                    <p class="delivery-title" style="text-align:left">${t('menu.livraison_label')}</p>
                                    <p class="delivery-desc">${t('menu.livraison_desc')}</p>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div id="delivery-zone-container-special" style="display: ${isDelivery ? 'block' : 'none'};">
                        <select id="delivery-zone-special" name="deliveryZone" class="form-control" onchange="window.updateSpecialDelivery()" style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid #d4af37; font-weight: bold;">
                            <option value="4" data-zone="${t('menu.zone_andre_bras')}" ${deliveryFee === 4 ? 'selected' : ''}>${t('menu.zone_andre_bras')} (4.00€)</option>
                            <option value="6" data-zone="${t('menu.zone_marie')}" ${deliveryFee === 6 ? 'selected' : ''}>${t('menu.zone_marie')} (6.00€)</option>
                            <option value="8" data-zone="${t('menu.zone_denis')}" ${deliveryFee === 8 ? 'selected' : ''}>${t('menu.zone_denis')} (8.00€)</option>
                        </select>
                    </div>
                </div>

                <div style="padding: 1.5rem; background: #fff; border-radius: 15px; border: 1px solid #eee;">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">        
                        <span style="color: #666; font-weight: 600;">${t('menu.cart_subtotal')}</span>
                        <span style="font-weight: 700;">${subtotal.toFixed(2)}€</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">       
                        <span style="color: #666; font-weight: 600;">${t('menu.cart_mode')}</span>
                        <span style="font-weight: 700;">${zoneName}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size: 1.4rem; font-weight: 900; color: #1a1a1a; padding-top: 10px; border-top: 1px solid #eee;">
                        <span>${t('menu.cart_total_label')}</span>
                        <span style="color: #d4af37;">${total.toFixed(2)}€</span>
                    </div>
                </div>
            </div>
        `;
    }

    window.updateSpecialDelivery = () => { renderCart(); };
    window.removeFromCart = (i) => { cart.splice(i, 1); renderCart(); };

    function renderCalendar(monthOffset = 0) {
        if (isOverrideEnabled) return;
        if (!calendarContainer) return;
        calendarContainer.innerHTML = '';
        const today = new Date(); today.setHours(0,0,0,0);
        const displayDate = new Date(); displayDate.setMonth(displayDate.getMonth() + monthOffset); displayDate.setDate(1);
        const month = displayDate.getMonth(); const year = displayDate.getFullYear();
        const monthNames = [
            t('calendar.months.jan'), t('calendar.months.feb'), t('calendar.months.mar'), 
            t('calendar.months.apr'), t('calendar.months.may'), t('calendar.months.jun'), 
            t('calendar.months.jul'), t('calendar.months.aug'), t('calendar.months.sep'), 
            t('calendar.months.oct'), t('calendar.months.nov'), t('calendar.months.dec')
        ];
        
        const allowedStart = new Date(today);
        if (today.getDay() === 0) allowedStart.setDate(today.getDate() + 1);
        else allowedStart.setDate(today.getDate() - (today.getDay() - 1));
        allowedStart.setHours(0,0,0,0);
        const allowedEnd = new Date(allowedStart); allowedEnd.setDate(allowedStart.getDate() + 5);

        const header = document.createElement('div');
        header.className = 'calendar-header';
        header.innerHTML = `<button type="button" onclick="window.changeMonth(${-1 + monthOffset})">&lt;</button><h2>${monthNames[month] || "Month"} ${year}</h2><button type="button" onclick="window.changeMonth(${1 + monthOffset})">&gt;</button>`;
        const grid = document.createElement('div');
        grid.className = 'calendar-grid';
        [t('calendar.days.sun'), t('calendar.days.mon'), t('calendar.days.tue'), t('calendar.days.wed'), t('calendar.days.thu'), t('calendar.days.fri'), t('calendar.days.sat')].forEach(d => grid.innerHTML += `<div class="calendar-day-header">${d}</div>`);
        
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
                el.addEventListener('click', () => { 
                    selectedDate = d; 
                    jourInput.value = ds; 
                    selectedDateDisplay.value = d.toLocaleDateString(i18next.language || 'fr-FR', {weekday:'long', day:'numeric', month:'long'}); 
                    renderCalendar(monthOffset); 
                });
            }
            if (selectedDate && d.getTime() === selectedDate.getTime()) el.classList.add('selected');
            grid.appendChild(el);
        }
        calendarContainer.appendChild(header); calendarContainer.appendChild(grid);
    }
    window.changeMonth = (o) => { renderCalendar(o); };

    async function fetchMenuContent() {
        try {
            const dispoRes = await fetch('/disponibilites?service_type=COMMANDE_MENU');
            if (dispoRes.ok) {
                const dispoData = await dispoRes.json();
                unavailableDates = dispoData.unavailableDates || [];
            }

            const response = await fetch('/get-menus');
            const data = await response.json();
            orderCutoffDays = data.order_cutoff_days || 2;
            orderCutoffHour = data.order_cutoff_hour || 11;

            if (data.menu_override_enabled === true || data.menu_override_enabled === 'true') {
                isOverrideEnabled = true;
                document.getElementById('menu-override-message').style.display = 'block';
                document.getElementById('menu-override-message').querySelector('p').innerHTML = marked.parse(data.menu_override_message);
                document.querySelectorAll('.weekly-menu-content, #formula-cards-container, #calendar-container, #whatsapp-button-container, .info-section').forEach(e => e.style.display = 'none');
                return;
            }

            // Remplissage du contenu des formules (avec rendu Markdown)
            const fillContent = (id, labelKey, val) => { 
                const el = document.getElementById(id);
                if(el) {
                    if (val && val.trim() !== "") {
                        // Utilisation de marked pour transformer le Markdown en HTML
                        // parseInline permet de garder le texte sur la même ligne que le label
                        const htmlContent = marked.parseInline(val);
                        el.innerHTML = `<strong>${t(labelKey)}</strong> ${htmlContent}`;
                        el.style.display = 'block';
                    } else {
                        el.style.display = 'none';
                    }
                }
            };
            fillContent('content-decouverte', 'menu.formula_discovery_label', data.menu_decouverte);
            fillContent('content-standard', 'menu.formula_standard_label', data.menu_standard);
            fillContent('content-confort', 'menu.formula_comfort_label', data.menu_confort);
            fillContent('content-duo', 'menu.formula_duo_label', data.menu_duo);
            
            // Mise à jour des prix sur les cartes de sélection
            const setPriceLabel = (id, price) => {
                const el = document.getElementById(id);
                if(el && price) el.textContent = `${price}€`;
            };
            setPriceLabel('price-decouverte', data.menu_decouverte_price);
            setPriceLabel('price-standard', data.menu_standard_price);
            setPriceLabel('price-confort', data.menu_confort_price);
            setPriceLabel('price-duo', data.menu_duo_price);

            if(data.special_offer_enabled === 'true') {
                specialOfferDetails = JSON.parse(data.special_offer_details);
                document.getElementById('special-offer-container').style.display = 'block';
                renderSpecialOffer(specialOfferDetails);
            }

            renderCalendar();
        } catch (e) {
            console.error("Erreur lors du chargement :", e);
            renderCalendar();
        }
    }

    fetchAndDisplayAnnouncement();
    fetchMenuContent();

    const updateSelectedCard = () => {
        cards.forEach(card => {
            const radio = card.querySelector('input[name="formule"]');
            if (radio && radio.checked) { card.classList.add('selected'); } 
            else { card.classList.remove('selected'); }
        });
    };

    document.querySelectorAll('input[name="formule"]').forEach(radio => {
        radio.addEventListener('change', updateSelectedCard);
    });

    cards.forEach(card => card.addEventListener('click', (e) => {
        if (e.target.closest('.sub-options') || e.target.closest('input')) return;
        const radio = card.querySelector('input[name="formule"]');
        if (radio) { radio.checked = true; updateSelectedCard(); }
    }));

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = form.querySelector('.cta-button');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        if (!data.jour || !data.email) return alert(t('menu.alert_fill_info') || 'Veuillez remplir vos informations.');

        const isDelivery = data.deliveryMode === 'livraison';
        const zoneSelect = document.getElementById('delivery-zone-special');
        const deliveryFee = isDelivery && zoneSelect ? parseFloat(zoneSelect.value) : 0;
        const zoneName = isDelivery && zoneSelect ? zoneSelect.options[zoneSelect.selectedIndex].getAttribute('data-zone') : t('menu.retrait_label') + " Saint-André";

        let orderPayload = {
            type: cart.length > 0 ? 'COMMANDE_SPECIALE' : 'COMMANDE_MENU',
            customer: { firstName: data.prenom, lastName: data.nom, phone: data.telephone, email: data.email },
            deliveryCity: data.livraison,
            requestDate: convertDateToISO(data.jour),
            customerType: 'Particulier',
            details: {
                deliveryMode: data.deliveryMode,
                deliveryZone: zoneName,
                deliveryFee: deliveryFee
            }
        };

        if (cart.length > 0) {
            orderPayload.details.cart = cart;
            orderPayload.total = cart.reduce((acc, item) => acc + (item.quantity * item.price), 0) + deliveryFee;
        } else {
            if (!data.formule) return alert(t('menu.alert_choose_formula') || 'Veuillez choisir une formule.');
            orderPayload.formulaName = data.formule;
            const opt = document.querySelector('.formula-card.selected input[name^="option"]:checked');   
            orderPayload.formulaOption = opt ? opt.value : null;
            orderPayload.total = null; 
        }

        submitBtn.textContent = t('menu.sending') || 'Envoi...';
        submitBtn.disabled = true;

        try {
            const token = await grecaptcha.execute('6LcYThAsAAAAAOV055t1Nvd5Uo94kcTmPUBd-cmq', {action: 'submit'});
            orderPayload.recaptchaToken = token;

            const res = await fetch('/create-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            if (!res.ok) throw new Error('Erreur lors de la sauvegarde.');

            let waMessage = `Bonjour, intention de commande pour le ${data.jour} :\n- Client : ${data.nom}\n- Formule : ${data.formule || t('menu.special_offer_title')}\n- Mode : ${zoneName}`;
            if (cart.length > 0) waMessage += `\n- Panier : ${cart.length} articles`;

            openWhatsAppLink('33767644714', waMessage);

            form.reset();
            cards.forEach(c => c.classList.remove('selected'));
            cart = []; renderCart();

        } catch (error) {
            alert(t('menu.error_occurred') || "Une erreur est survenue. Veuillez réessayer.");
            console.error(error);
        } finally {
            submitBtn.textContent = t('menu.to_order_cta') || 'Commander via WhatsApp';
            submitBtn.disabled = false;
        }
    });
});
