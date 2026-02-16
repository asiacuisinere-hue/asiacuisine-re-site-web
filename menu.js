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
    const stickyTotalEl = document.getElementById('sticky-total');

    const steps = document.querySelectorAll('.step-section');
    const progressSteps = document.querySelectorAll('.stepper-progress .step');
    const btnPrev = document.getElementById('prev-step');
    const btnNext = document.getElementById('next-step');
    const btnSubmit = document.getElementById('submit-order');

    let currentStep = 1;
    let currentUniverse = 'weekly';
    let unavailableDates = [];
    let workingDays = [];
    let selectedDate = null;
    let isOverrideEnabled = false;
    let orderCutoffDays = 2;
    let orderCutoffHour = 11;
    let specialOfferDetails = null;
    let cart = [];
    let menuPrices = {};

    const t = (key) => typeof i18next !== 'undefined' ? i18next.t(key) : key;

    const getLangText = (dataField) => {
        if (!dataField) return "";
        let obj = dataField;
        if (typeof obj === 'string' && obj.trim().startsWith('{')) {
            try { obj = JSON.parse(obj); } catch(e) { return dataField; }
        }
        if (typeof obj === 'object' && obj !== null) {
            const lang = (typeof i18next !== 'undefined' && i18next.language) || 'fr';
            return obj[lang] || obj['fr'] || Object.values(obj).find(v => v !== "") || "";
        }
        return String(dataField);
    };

    const weeklyContent = document.getElementById('weekly-universe-content');
    const specialContent = document.getElementById('special-universe-content');
    const uniButtons = document.querySelectorAll('.universe-btn');

    uniButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-universe');
            if (target === currentUniverse) return;
            const hasSelection = (currentUniverse === 'weekly' && document.querySelector('input[name="formule"]:checked')) || (currentUniverse === 'special' && cart.length > 0);
            if (hasSelection && !confirm("Changer de menu videra votre sélection actuelle. Continuer ?")) return;
            currentUniverse = target;
            uniButtons.forEach(b => b.classList.toggle('active', b === btn));
            if (currentUniverse === 'weekly') {
                if(weeklyContent) weeklyContent.style.display = 'block';
                if(specialContent) specialContent.style.display = 'none';
                cart = []; renderCart();
            } else {
                if(weeklyContent) weeklyContent.style.display = 'none';
                if(specialContent) specialContent.style.display = 'block';
                document.querySelectorAll('input[name="formule"]').forEach(r => r.checked = false);       
                cards.forEach(c => c.classList.remove('selected'));
                if (specialOfferDetails) renderSpecialOffer(specialOfferDetails);
            }
            updateStickyTotal();
        });
    });

    function convertDateToISO(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
    }

    function openWhatsAppLink(phone, message) {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message.trim())}`;
        window.location.assign(url);
    }

    const updateStepUI = () => {
        steps.forEach((section, idx) => { section.classList.toggle('active', idx + 1 === currentStep); });
        progressSteps.forEach((step, idx) => {
            const stepNum = idx + 1;
            step.classList.toggle('active', stepNum === currentStep);
            step.classList.toggle('completed', stepNum < currentStep);
        });
        if(btnPrev) btnPrev.style.display = currentStep > 1 ? 'block' : 'none';
        if(btnNext) btnNext.style.display = currentStep < 3 ? 'block' : 'none';
        if(btnSubmit) btnSubmit.style.display = currentStep === 3 ? 'block' : 'none';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const validateStep = () => {
        if (currentStep === 1) {
            if (currentUniverse === 'weekly') {
                const formulaRadio = document.querySelector('input[name="formule"]:checked');
                if (!formulaRadio) { alert(t('menu.alert_choose_formula')); return false; }
                const formulaVal = formulaRadio.value;
                if (formulaVal.includes('Standard') || formulaVal.includes('Confort') || formulaVal.includes('Duo')) {
                    const card = formulaRadio.closest('.formula-card');
                    const hasOption = card.querySelector('input[name^="option"]:checked');
                    if (!hasOption) { alert("Veuillez sélectionner une option (A ou B) pour cette formule."); return false; }
                }
            } else if (cart.length === 0) { alert("Veuillez ajouter au moins un plat à votre panier."); return false; }
        }
        if (currentStep === 2) {
            if (!jourInput.value || !document.getElementById('livraison').value) { alert("Veuillez choisir une date et une ville."); return false; }
        }
        return true;
    };

    if(btnNext) btnNext.addEventListener('click', () => {
        if (validateStep()) {
            if (currentUniverse === 'special' && currentStep === 1) currentStep = 3;
            else currentStep++;
            updateStepUI();
        }
    });

    if(btnPrev) btnPrev.addEventListener('click', () => {
        if (currentUniverse === 'special' && currentStep === 3) currentStep = 1;
        else currentStep--;
        updateStepUI();
    });

    function updateStickyTotal() {
        let total = 0;
        if (currentUniverse === 'special' && cart.length > 0) {
            const subtotal = cart.reduce((acc, item) => acc + (item.quantity * item.price), 0);
            const deliveryMode = form.querySelector('input[name="deliveryMode"]:checked')?.value || 'retrait';
            let deliveryFee = 0;
            if (deliveryMode === 'livraison') {
                const zoneSelect = document.getElementById('delivery-zone-special');
                deliveryFee = zoneSelect ? parseFloat(zoneSelect.value) : 0;
            }
            total = subtotal + deliveryFee;
        } else if (currentUniverse === 'weekly') {
            const rad = document.querySelector('input[name="formule"]:checked');
            if(rad) {
                const val = rad.value;
                if (val.includes('Découverte')) total = menuPrices.menu_decouverte_price;
                else if (val.includes('Standard')) total = menuPrices.menu_standard_price;
                else if (val.includes('Confort')) total = menuPrices.menu_confort_price;
                else if (val.includes('Duo')) total = menuPrices.menu_duo_price;
            }
        }
        if (stickyTotalEl) stickyTotalEl.textContent = `${parseFloat(total || 0).toFixed(2)}€`;
    }

    function startCountdown(cutoffISO) {
        const timerEl = document.getElementById('countdown-timer');
        if (!timerEl || !cutoffISO) return;
        const update = () => {
            const now = new Date().getTime();
            const distance = new Date(cutoffISO).getTime() - now;
            if (distance < 0) {
                timerEl.innerHTML = "<div style='background:#fee2e2; padding:10px; border-radius:12px; border:1px solid #ef4444; margin-bottom:1.5rem; text-align:center;'><span style='color:#ef4444; font-weight:900;'>⌛ DÉLAI DE COMMANDE DÉPASSÉ</span></div>";
                const addBtn = document.getElementById('add-to-cart-btn');
                if (addBtn) { addBtn.disabled = true; addBtn.textContent = "Indisponible"; }
                return;
            }
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            timerEl.innerHTML = `<div style="display:flex; gap:10px; align-items:center; justify-content:center; background:#fff1f2; padding:10px; border-radius:12px; border:1px solid #fecdd3; margin-bottom:1.5rem;"><span style="font-size:1.2rem;">⏳</span><div style="text-align:left;"><p style="font-size:0.7rem; font-weight:900; color:#e11d48; margin:0; text-transform:uppercase; letter-spacing:0.5px;">Temps restant pour commander</p><p style="font-family:monospace; font-size:1.1rem; font-weight:900; color:#1a1a1a; margin:0;">${days}j ${hours}h ${minutes}m ${seconds}s</p></div></div>`;
        };
        update(); setInterval(update, 1000);
    }

    function renderSpecialOffer(offer) {
        const container = document.getElementById('special-offer-container');
        if (!container || !offer || !offer.dishes) return;
        const dishOptions = offer.dishes.map((dish, index) => {
            const minPrice = Math.min(parseFloat(dish.price1) || 0, parseFloat(dish.price2) || 0);        
            return `<option value="${index}">${getLangText(dish.name)} (dès ${minPrice.toFixed(2)}€)</option>`;
        }).join('');
        container.innerHTML = `<div class="menu-info-box" style="border-left-color: #ef4444;"><h2 style="color:#ef4444; text-align:left;">🔥 ${getLangText(offer.title) || t('menu.special_offer_title')}</h2>${offer.period ? `<p style="font-weight:900; color:#ef4444; font-size:0.85rem; margin-bottom:0.5rem;">📅 ${offer.period}</p>` : ''}<p style="margin-bottom:1.5rem; font-size:0.9rem; color:#666; text-align:left;">${getLangText(offer.description) || ''}</p><div id="countdown-timer"></div><div class="form-grid" style="align-items: flex-end; gap: 10px;"><div class="form-group"><label>${t('menu.special_offer_dish')}</label><select id="special-offer-dish" class="app-input" style="padding:0.8rem">${dishOptions}</select></div><div class="form-group"><label>${t('menu.special_offer_portion')}</label><select id="special-offer-portion" class="app-input" style="padding:0.8rem"></select></div><div class="form-group"><label>${t('menu.special_offer_quantity')}</label><input type="number" id="special-offer-quantity" class="app-input" style="padding:0.8rem" value="1" min="1"></div><button type="button" id="add-to-cart-btn" class="btn-next" style="width:100%; height:45px; padding:0; margin-top:10px;">Ajouter</button></div></div>`;
        if (offer.cutoff) startCountdown(offer.cutoff);
        const updatePortions = (idx) => {
            const d = offer.dishes[idx]; if(!d) return;
            document.getElementById('special-offer-portion').innerHTML = `<option value="1">${d.label1} - ${parseFloat(d.price1 || 0).toFixed(2)}€</option><option value="2">${d.label2} - ${parseFloat(d.price2 || 0).toFixed(2)}€</option>`;
        };
        const ds = document.getElementById('special-offer-dish'); if(ds) { ds.addEventListener('change', (e) => updatePortions(e.target.value)); updatePortions(0); }
        const ab = document.getElementById('add-to-cart-btn');
        if(ab) {
            ab.addEventListener('click', () => {
                const idx = document.getElementById('special-offer-dish').value;
                const port = document.getElementById('special-offer-portion').value;
                const q = parseInt(document.getElementById('special-offer-quantity').value);
                const d = offer.dishes[idx];
                cart.push({ name: d.name, portion: port === '1' ? d.label1 : d.label2, quantity: q, price: parseFloat(port === '1' ? d.price1 : d.price2) });
                renderCart();
            });
        }
    }

    function renderCart() {
        const container = document.getElementById('special-offer-summary');
        if (!container) return;
        if (cart.length === 0) { container.innerHTML = ''; updateStickyTotal(); return; }
        const isDelivery = form.querySelector('input[name="deliveryMode"]:checked')?.value === 'livraison';
        const itemsHtml = cart.map((item, i) => `<div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; font-size:0.9rem"><span><strong>${item.quantity}x</strong> ${getLangText(item.name)} <br><small>${item.portion}</small></span><span>${(item.quantity * item.price).toFixed(2)}€ <button type="button" onclick="window.removeFromCart(${i})" style="color:red; background:none; border:none; font-size:1.2rem; margin-left:10px;">&times;</button></span></div>`).join('');
        container.innerHTML = `<div style="background: #fffdf5; border: 2px solid #d4af37; border-radius: 20px; padding: 1.5rem; margin-top: 1.5rem;"><h3 style="margin-top:0; text-align: left !important; font-size:1rem;">🛒 Votre Panier</h3><div style="margin-bottom: 1rem;">${itemsHtml}</div><div style="border-top: 1px solid #eee; padding-top: 1rem;"><p style="font-weight: 900; font-size: 0.75rem; margin-bottom: 0.8rem; text-transform: uppercase; color: #d4af37;">Option de réception</p><div class="delivery-options" style="margin-bottom: 1rem; gap:8px;"><label class="delivery-type-label"><input type="radio" name="deliveryMode" value="retrait" ${!isDelivery ? 'checked' : ''} onchange="window.updateSpecialDelivery()"><div class="delivery-box" style="padding:8px">📍 <span style="font-size:0.8rem; font-weight:900">Retrait</span></div></label><label class="delivery-type-label"><input type="radio" name="deliveryMode" value="livraison" ${isDelivery ? 'checked' : ''} onchange="window.updateSpecialDelivery()"><div class="delivery-box" style="padding:8px">🚚 <span style="font-size:0.8rem; font-weight:900">Livraison</span></div></label></div><div id="delivery-zone-container-special" style="display: ${isDelivery ? 'block' : 'none'};"><select id="delivery-zone-special" name="deliveryZone" class="app-input" onchange="window.updateSpecialDelivery()" style="padding:0.6rem; font-size:0.85rem"><option value="4" data-zone="Saint-André / Bras-Panon">Saint-André / Bras-Panon (4.00€)</option><option value="6" data-zone="Sainte-Marie">Sainte-Marie (6.00€)</option><option value="8" data-zone="Saint-Denis">Saint-Denis (8.00€)</option></select></div></div></div>`;
        updateStickyTotal();
    }
    window.updateSpecialDelivery = () => renderCart();
    window.removeFromCart = (i) => { cart.splice(i, 1); renderCart(); };

    function renderCalendar(monthOffset = 0) {
        if (isOverrideEnabled || !calendarContainer) return;
        calendarContainer.innerHTML = '';
        const today = new Date(); today.setHours(0,0,0,0);
        const displayDate = new Date(); displayDate.setMonth(displayDate.getMonth() + monthOffset); displayDate.setDate(1);
        const month = displayDate.getMonth(); const year = displayDate.getFullYear();
        const monthNames = [t('calendar.months.jan'), t('calendar.months.feb'), t('calendar.months.mar'), t('calendar.months.apr'), t('calendar.months.may'), t('calendar.months.jun'), t('calendar.months.jul'), t('calendar.months.aug'), t('calendar.months.sep'), t('calendar.months.oct'), t('calendar.months.nov'), t('calendar.months.dec')];

        const now = new Date();
        const currentDay = now.getDay();
        const currentHour = now.getHours();

        let allowedStart = new Date(today);

        if (currentDay === 6 || (currentDay === 5 && currentHour >= 14) || currentDay === 0) {
            const daysToNextMonday = (8 - currentDay) % 7 || 7;
            allowedStart.setDate(today.getDate() + daysToNextMonday);
        } else {
            const offsetToMonday = (1 - currentDay);
            allowedStart.setDate(today.getDate() + offsetToMonday);
        }
        allowedStart.setHours(0,0,0,0);

        const allowedEnd = new Date(allowedStart);
        allowedEnd.setDate(allowedStart.getDate() + 5); 

        const header = document.createElement('div'); header.className = 'calendar-header';
        header.innerHTML = `<button type="button" onclick="window.changeMonth(${-1 + monthOffset})">&lt;</button><h3>${monthNames[month]} ${year}</h3><button type="button" onclick="window.changeMonth(${1 + monthOffset})">&gt;</button>`;
        const grid = document.createElement('div'); grid.className = 'calendar-grid';
        [t('calendar.days.sun'), t('calendar.days.mon'), t('calendar.days.tue'), t('calendar.days.wed'), t('calendar.days.thu'), t('calendar.days.fri'), t('calendar.days.sat')].forEach(d => grid.innerHTML += `<div class="calendar-day-header">${d}</div>`);

        for (let i = 0; i < new Date(year, month, 1).getDay(); i++) grid.appendChild(document.createElement('div'));
        for (let i = 1; i <= new Date(year, month + 1, 0).getDate(); i++) {
            const d = new Date(year, month, i); d.setHours(0,0,0,0);
            const ds = `${String(i).padStart(2,'0')}/${String(month+1).padStart(2,'0')}/${year}`;
            const el = document.createElement('div'); el.className = 'calendar-day'; el.textContent = i;  

            const isWorkingDay = workingDays.includes(d.getDay());
            const cutoff = new Date(d);
            cutoff.setDate(d.getDate() - parseInt(orderCutoffDays || 2));
            cutoff.setHours(parseInt(orderCutoffHour || 11), 0, 0, 0);

            const isTooEarly = d < allowedStart;
            const isTooLate = d > allowedEnd;
            const isCutoffPassed = new Date() > cutoff;
            const isBlocked = unavailableDates.includes(ds);

            let disabled = (!isWorkingDay || isTooEarly || isTooLate || isCutoffPassed || isBlocked);     

            if (disabled) el.classList.add('disabled');
            else {
                el.classList.add('available');
                el.addEventListener('click', () => { selectedDate = d; jourInput.value = ds; selectedDateDisplay.textContent = d.toLocaleDateString(i18next.language || 'fr-FR', {weekday:'long', day:'numeric', month:'long'}); renderCalendar(monthOffset); });
            }
            if (selectedDate && d.getTime() === selectedDate.getTime()) el.classList.add('selected');     
            grid.appendChild(el);
        }
        calendarContainer.appendChild(header); calendarContainer.appendChild(grid);
    }
    window.changeMonth = (o) => renderCalendar(o);

    async function fetchMenuContent() {
        try {
            const dispoRes = await fetch('/disponibilites?service_type=COMMANDE_MENU');
            if (dispoRes.ok) {
                const dispoData = await dispoRes.json();
                unavailableDates = dispoData.unavailableDates || [];
                const s = dispoData.settings || {};
                workingDays = [];
                if (s.monday === true || s.monday === 'true') workingDays.push(1);
                if (s.tuesday === true || s.tuesday === 'true') workingDays.push(2);
                if (s.wednesday === true || s.wednesday === 'true') workingDays.push(3);
                if (s.thursday === true || s.thursday === 'true') workingDays.push(4);
                if (s.friday === true || s.friday === 'true') workingDays.push(5);
                if (s.saturday === true || s.saturday === 'true') workingDays.push(6);
                if (s.sunday === true || s.sunday === 'true') workingDays.push(0);
            }

            const now = new Date(); let year = now.getFullYear();
            const dCalc = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
            dCalc.setUTCDate(dCalc.getUTCDate() + 4 - (dCalc.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(dCalc.getUTCFullYear(), 0, 1));
            let weekNumber = Math.ceil((((dCalc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);   
            if (now.getDay() === 6 || (now.getDay() === 5 && now.getHours() >= 14) || now.getDay() === 0) {
                weekNumber++;
                if (weekNumber > 52) { weekNumber = 1; year++; }
            }

            const response = await fetch(`/get-menus?week=${weekNumber}&year=${year}`);
            const data = await response.json();
            orderCutoffDays = data.order_cutoff_days || 2; orderCutoffHour = data.order_cutoff_hour || 11;
            menuPrices = { menu_decouverte_price: parseFloat(data.menu_decouverte_price || 0), menu_standard_price: parseFloat(data.menu_standard_price || 0), menu_confort_price: parseFloat(data.menu_confort_price || 0), menu_duo_price: parseFloat(data.menu_duo_price || 0) };

            if (data.menu_override_enabled === 'true' || data.menu_override_enabled === true) {
                isOverrideEnabled = true; const overrideEl = document.getElementById('menu-override-message');
                if(overrideEl) { overrideEl.style.display = 'block'; overrideEl.querySelector('p').innerHTML = marked.parse(data.menu_override_message); }
                document.querySelectorAll('#whatsapp-order-form, .stepper-progress').forEach(e => e.style.display = 'none'); return;
            }

            const fillContent = (id, labelKey, val) => {
                const el = document.getElementById(id); const translatedVal = getLangText(val);
                if(el && translatedVal && translatedVal.trim() !== "") {
                    let formatted = translatedVal.replace(/\n/g, '<br>');
                    formatted = formatted.replace(/(Option A[:.-]?)/gi, '<br><strong style="color: #f6ce0d;">$1</strong>');
                    formatted = formatted.replace(/(Option B[:.-]?)/gi, '<br><br><strong style="color: #f6ce0d;">$1</strong>');
                    formatted = formatted.replace(/(<\/strong>)\s*<br>/gi, '$1 ');
                    el.innerHTML = `<strong>${t(labelKey)}</strong>${formatted}`; el.style.display = 'block';
                    return translatedVal;
                } else if(el) { el.style.display = 'none'; return ""; }
            };

            const standardContent = getLangText(data.menu_standard);
            fillContent('content-decouverte', 'menu.formula_discovery_label', data.menu_decouverte);      
            fillContent('content-standard', 'menu.formula_standard_label', data.menu_standard);
            const confortVal = getLangText(data.menu_confort);
            const duoVal = getLangText(data.menu_duo);
            if (confortVal !== "" && confortVal !== standardContent) fillContent('content-confort', 'menu.formula_comfort_label', data.menu_confort);
            else { const el = document.getElementById('content-confort'); if(el) el.style.display = 'none'; }
            if (duoVal !== "" && duoVal !== standardContent) fillContent('content-duo', 'menu.formula_duo_label', data.menu_duo);
            else { const el = document.getElementById('content-duo'); if(el) el.style.display = 'none'; } 

            document.querySelectorAll('.formula-card').forEach(card => card.style.display = 'block');     

            const d1 = document.getElementById('price-decouverte'); if(d1) d1.textContent = `${data.menu_decouverte_price}€`;
            const d2 = document.getElementById('price-standard'); if(d2) d2.textContent = `${data.menu_standard_price}€`;
            const d3 = document.getElementById('price-confort'); if(d3) d3.textContent = `${data.menu_confort_price}€`;
            const d4 = document.getElementById('price-duo'); if(d4) d4.textContent = `${data.menu_duo_price}€`;

            if(data.special_offer_enabled === 'true' || data.special_offer_enabled === true) {
                specialOfferDetails = typeof data.special_offer_details === 'string' ? JSON.parse(data.special_offer_details) : data.special_offer_details;
                if (document.getElementById('universe-btn-special')) document.getElementById('universe-btn-special').style.display = 'flex';
                renderSpecialOffer(specialOfferDetails);
            }
            renderCalendar();
        } catch (e) { console.error("Error:", e); renderCalendar(); }
    }

    fetchAndDisplayAnnouncement();
    fetchMenuContent();

    const sheet = document.getElementById('bottom-sheet');
    const sheetBody = document.getElementById('sheet-body');
    const sheetTitle = document.getElementById('sheet-title');
    const sheetClose = document.querySelector('.sheet-close');
    const openSheet = (title, contentHtml) => {
        if (!sheet) return; sheetTitle.textContent = title; sheetBody.innerHTML = contentHtml; sheet.classList.add('is-visible');
        sheetBody.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const name = input.getAttribute('name'); const val = input.value;
                const original = document.querySelector(`.formula-card.selected input[name="${name}"][value="${val}"]`);
                if (original) original.checked = true; setTimeout(() => sheet.classList.remove('is-visible'), 300);
            });
        });
    };
    if (sheetClose) sheetClose.addEventListener('click', () => sheet.classList.remove('is-visible'));     
    if (sheet) sheet.querySelector('.sheet-overlay').addEventListener('click', () => sheet.classList.remove('is-visible'));

    const updateSelectedCard = () => {
        cards.forEach(card => {
            const radio = card.querySelector('input[name="formule"]');
            if (radio && radio.checked) {
                card.classList.add('selected'); cart = []; renderCart();
                const subOptions = card.querySelector('.sub-options');
                if (subOptions) openSheet(radio.value, subOptions.innerHTML);
            } else { card.classList.remove('selected'); }
        });
        updateStickyTotal();
    };
    document.querySelectorAll('input[name="formule"]').forEach(radio => radio.addEventListener('change', updateSelectedCard));
    cards.forEach(card => card.addEventListener('click', (e) => {
        if (e.target.closest('.sub-options') || e.target.closest('input')) return;
        const radio = card.querySelector('input[name="formule"]');
        if (radio) { radio.checked = true; updateSelectedCard(); }
    }));

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtnReal = document.getElementById('submit-order');
        const formData = new FormData(form); const data = Object.fromEntries(formData.entries());
        const isDelivery = data.deliveryMode === 'livraison';
        const zoneSelect = document.getElementById('delivery-zone-special');
        const deliveryFee = isDelivery && zoneSelect ? parseFloat(zoneSelect.value) : 0;
        const zoneName = isDelivery && zoneSelect ? zoneSelect.options[zoneSelect.selectedIndex].getAttribute('data-zone') : t('menu.retrait_label');
        let finalCity = data.livraison;
        if (currentUniverse === 'special') {
            if (zoneName.includes('André')) finalCity = 'Saint-André'; else if (zoneName.includes('Marie')) finalCity = 'Sainte-Marie'; else if (zoneName.includes('Denis')) finalCity = 'Saint-Denis'; else finalCity = 'Saint-André';
        }
        let orderPayload = { type: currentUniverse === 'special' ? 'COMMANDE_SPECIALE' : 'COMMANDE_MENU', customer: { firstName: data.prenom, lastName: data.nom, phone: data.telephone, email: data.email }, deliveryCity: finalCity, requestDate: currentUniverse === 'special' ? specialOfferDetails.eventDate : convertDateToISO(data.jour), customerType: 'Particulier', details: { deliveryMode: data.deliveryMode || 'retrait', deliveryZone: zoneName, deliveryFee: deliveryFee } };
        if (currentUniverse === 'special') { orderPayload.details.cart = cart; orderPayload.total = cart.reduce((acc, item) => acc + (item.quantity * item.price), 0) + deliveryFee; }
        else { orderPayload.formulaName = data.formule; const opt = document.querySelector('.formula-card.selected input[name^="option"]:checked'); orderPayload.formulaOption = opt ? opt.value : null; orderPayload.total = null; }
        if(submitBtnReal) { submitBtnReal.textContent = t('menu.sending'); submitBtnReal.disabled = true; }
        try {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            let token = "local-test-token";
            try { token = await grecaptcha.execute('6LcYThAsAAAAAOV055t1Nvd5Uo94kcTmPUBd-cmq', {action: 'submit'}); } catch (reErr) { if (!isLocal) throw reErr; }

            orderPayload.recaptchaToken = token;

            const res = await fetch('/create-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderPayload) });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("DÉTAIL ERREUR SERVEUR:", errorData);
                const errorMsg = errorData.details?.['error-codes']?.join(', ') || errorData.error || 'Erreur serveur';
                throw new Error("Erreur : " + errorMsg);
            }

            let formulaText = data.formule || (specialOfferDetails ? specialOfferDetails.title : '');
            const opt = document.querySelector('.formula-card.selected input[name^="option"]:checked');
            if (opt && currentUniverse === 'weekly') {
                formulaText += ` (${opt.value})`;
            }

            let waMessage = `Bonjour, intention de commande pour le ${data.jour || (specialOfferDetails ? specialOfferDetails.eventDate : '')} :\n- Client : ${data.nom}\n- Formule : ${formulaText}\n- Mode : ${zoneName}`;
            if (currentUniverse === 'special' && cart.length > 0) { 
                const itemsList = cart.map(item => `- ${item.quantity}x ${getLangText(item.name)} (${item.portion})`).join('\n'); 
                waMessage = `Bonjour, intention de commande ÉVÉNEMENT pour le ${specialOfferDetails.eventDate} :\n- Client : ${data.nom}\n${itemsList}\n- Mode : ${zoneName}`; 
            }
            openWhatsAppLink('33767644714', waMessage);
            form.reset(); currentStep = 1; updateStepUI(); cart = []; renderCart();
        } catch (error) { alert(t('menu.error_occurred')); } finally { if(submitBtnReal) { submitBtnReal.textContent = t('menu.to_order_cta'); submitBtnReal.disabled = false; } }
    });

    const modal = document.getElementById('cgv-modal');
    const openBtn = document.getElementById('open-cgv-modal');
    const closeBtns = document.querySelectorAll('.close-modal');
    const cgvBody = document.getElementById('cgv-content-body');
    const cgvCheckbox = document.getElementById('cgv_acceptance');
    const toggleModal = (show) => {
        if (modal) modal.classList.toggle('is-visible', show);
        if (show && cgvBody && (cgvBody.innerHTML.includes("Chargement") || cgvBody.innerHTML === "")) {  
            fetch('cgv.html').then(res => res.text()).then(html => {
                const parser = new DOMParser(); const doc = parser.parseFromString(html, 'text/html');    
                const mainContent = doc.querySelector('.legal-container') || doc.querySelector('main') || doc.body;
                cgvBody.innerHTML = mainContent.innerHTML;
                if (window.i18next && typeof i18next.t === 'function') { cgvBody.querySelectorAll('[data-i18n]').forEach(el => { const key = el.getAttribute('data-i18n'); if (key) el.innerHTML = i18next.t(key); }); }
            }).catch(() => { cgvBody.innerHTML = "Erreur lors du chargement des CGV."; });
        }
    };
    if (openBtn) openBtn.addEventListener('click', () => toggleModal(true));
    closeBtns.forEach(btn => btn.addEventListener('click', () => toggleModal(false)));
    if (modal) modal.querySelector('.modal-overlay').addEventListener('click', () => toggleModal(false)); 
    if (cgvCheckbox && btnSubmit) {
        btnSubmit.disabled = !cgvCheckbox.checked; btnSubmit.style.opacity = cgvCheckbox.checked ? '1' : '0.5';
        cgvCheckbox.addEventListener('change', () => { btnSubmit.disabled = !cgvCheckbox.checked; btnSubmit.style.opacity = cgvCheckbox.checked ? '1' : '0.5'; });
    }
    updateStepUI();
});
