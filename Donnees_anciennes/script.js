// --- SCRIPT INITIALIZATION ---

async function main() {
    await initializeI18n();
    initializePageContent();
}

document.addEventListener('DOMContentLoaded', main);

// --- I18N (TRANSLATION) LOGIC ---
async function initializeI18n() {
    try {
        const [frResponse, enResponse, zhResponse] = await Promise.all([
            fetch('./locales/fr.json'),
            fetch('./locales/en.json'),
            fetch('./locales/zh.json')
        ]);
        const [frTranslation, enTranslation, zhTranslation] = await Promise.all([
            frResponse.json(),
            enResponse.json(),
            zhResponse.json()
        ]);
        const lang = new URLSearchParams(window.location.search).get('lang') || 'fr';
        await i18next.init({
            lng: lang,
            debug: false,
            resources: { fr: frTranslation, en: enTranslation, zh: zhTranslation }
        });
    } catch (error) {
        console.error('i18next initialization failed:', error);
    }
}

function updateContent() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        el.placeholder = key.startsWith('[placeholder]') ? i18next.t(key.replace('[placeholder]', '')) : el.placeholder;
        if (!key.startsWith('[placeholder]')) el.innerHTML = i18next.t(key);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.toggle('active-lang', btn.dataset.lang === i18next.language));
    const currentLang = i18next.language;
    document.querySelectorAll('a').forEach(link => {
        try {
            const url = new URL(link.href);
            if (link.hostname === window.location.hostname) {
                url.searchParams.set('lang', currentLang);
                link.href = url.toString();
            }
        } catch (e) { /* Ignore invalid URLs */ }
    });
}

function createLanguageSwitcher() {
    const navContainer = document.querySelector('.nav-container');
    if (!navContainer) return;
    const switcher = document.createElement('div');
    switcher.className = 'language-switcher';
    switcher.innerHTML = `<button class="lang-btn" data-lang="fr">FR</button> | <button class="lang-btn" data-lang="en">EN</button> | <button class="lang-btn" data-lang="zh">ZH</button>`;
    const mobileToggle = document.querySelector('.nav-toggle');
    navContainer.insertBefore(switcher, mobileToggle || null);
    switcher.addEventListener('click', (e) => {
        if (e.target.matches('.lang-btn')) {
            const lang = e.target.dataset.lang;
            const url = new URL(window.location);
            url.searchParams.set('lang', lang);
            window.location.href = url.toString();
        }
    });
}

function initializePageContent() {
    updateContent();
    createLanguageSwitcher();
    initializeCookieConsent();
    initializeWelcomePopup();
    fetchAndInitializeDatepicker();
    if (document.querySelector('#accueil')) {
        initializeScrollBasedEffects();
        initializeServiceMenu();
        initializeMobileMenu();
        initializeBackToTopButton();
        initializeLightbox();
        initializeForm();
        handleResponsiveLayout();
        window.addEventListener('resize', handleResponsiveLayout);
    }
    initializeSubscriptionForm();
    initializeWhatsAppLinks();
}

function handleResponsiveLayout() {
    const switcher = document.querySelector('.language-switcher');
    const navContainer = document.querySelector('.nav-container');
    const navLinks = document.querySelector('.nav-links');
    const navToggle = document.querySelector('.nav-toggle');
    if (!switcher || !navContainer || !navLinks || !navToggle) return;
    if (window.innerWidth <= 800 && !navLinks.contains(switcher)) navLinks.appendChild(switcher);
    else if (window.innerWidth > 800 && !navContainer.contains(switcher)) navContainer.insertBefore(switcher, navToggle);
}

function initializeScrollBasedEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => entry.isIntersecting && entry.target.classList.add('visible'));
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
    window.addEventListener('scroll', () => {
        document.querySelector('.navbar')?.style.setProperty('background', window.scrollY > 50 ? 'rgba(20, 20, 20, 0.98)' : 'rgba(20, 20, 20, 0.95)');
        document.querySelector('.hero')?.style.setProperty('transform', `translateY(${window.pageYOffset * 0.4}px)`);
    }, { passive: true });
}

async function fetchAndInitializeDatepicker() {
    const dateInput = document.getElementById('date');
    if (!dateInput) return;
    try {
        const response = await fetch('/disponibilites?service_type=RESERVATION_SERVICE');
        if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
        const unavailableDates = await response.json() || [];
        new Datepicker(dateInput, {
            format: 'dd/mm/yyyy', language: 'fr', autohide: true,
            datesDisabled: unavailableDates,
            minDate: new Date(new Date().setDate(new Date().getDate() + 7)),
            showDaysInNextAndPreviousMonths: false
        });
    } catch (error) {
        console.error('Failed to fetch availability:', error);
        dateInput.placeholder = 'Erreur de chargement.';
        dateInput.disabled = true;
    }
}

function initializeServiceMenu() {
    const flippablePages = document.querySelectorAll('.flippable-page');
    let currentFlippedIndex = 0;
    const updateMenuState = () => flippablePages.forEach((page, index) => {
        page.classList.toggle('is-flipped', index < currentFlippedIndex);
        page.style.zIndex = index < currentFlippedIndex ? 10 + index : flippablePages.length - index;
    });
    const goToNextPage = () => { if (currentFlippedIndex < flippablePages.length) { currentFlippedIndex++; updateMenuState(); } };
    const goToPrevPage = () => { if (currentFlippedIndex > 0) { currentFlippedIndex--; updateMenuState(); } };
    if (flippablePages.length > 0) {
        flippablePages.forEach(page => {
            page.querySelector('.page-front')?.addEventListener('click', goToNextPage);
            page.querySelector('.page-back')?.addEventListener('click', goToPrevPage);
        });
        updateMenuState();
    }
}

function initializeMobileMenu() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navLinks.classList.toggle('active');
        });
    }
}

function initializeBackToTopButton() {
    const backToTopBtn = document.getElementById('back-to-top-btn');
    if (backToTopBtn) {
        window.addEventListener('scroll', () => backToTopBtn.classList.toggle('visible', window.scrollY > 300), { passive: true });
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type} is-visible`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.remove('is-visible');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 4000);
}

function initializeForm() {
    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    const convertDateToISO = (dateString) => {
        if (!dateString) return null;
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
    };

    const individualFieldsDiv = document.getElementById('particulier-fields');
    const companyFieldsDiv = document.getElementById('entreprise-fields');
    const individualRadio = document.getElementById('customer_type_individual');
    const companyRadio = document.getElementById('customer_type_company');

    const toggleCustomerFields = () => {
        const isIndividual = individualRadio.checked;
        individualFieldsDiv.style.display = isIndividual ? 'block' : 'none';
        companyFieldsDiv.style.display = isIndividual ? 'none' : 'block';
        individualFieldsDiv.querySelectorAll('input').forEach(input => input.required = isIndividual);
        companyFieldsDiv.querySelectorAll('input').forEach(input => input.required = !isIndividual);
    };

    toggleCustomerFields();
    individualRadio.addEventListener('change', toggleCustomerFields);
    companyRadio.addEventListener('change', toggleCustomerFields);

    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('.submit-btn');
        if (typeof grecaptcha === 'undefined') return showNotification('Erreur de configuration de la sécurité.', 'error');
        
        grecaptcha.ready(() => {
            grecaptcha.execute('%%RECAPTCHA_SITE_KEY%%', {action: 'submit'}).then(async (recaptchaToken) => {
                const formData = new FormData(this);
                const data = Object.fromEntries(formData.entries());
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Envoi en cours...';
                submitBtn.disabled = true;

                const payload = {
                    type: 'RESERVATION_SERVICE',
                    customerType: data.customer_type,
                    customer: data.customer_type === 'Particulier'
                        ? { lastName: data.nom_particulier, email: data.email_particulier, phone: data.telephone_particulier }
                        : { companyName: data.nom_entreprise, siret: data.siret, contactName: data.nom_contact_entreprise, contactEmail: data.email_contact_entreprise, contactPhone: data.telephone_contact_entreprise },
                    requestDate: convertDateToISO(data.date),
                    heure: data.heure,
                    serviceType: data.service,
                    numberOfPeople: data.personnes,
                    ville: data.ville,
                    budget: data.budget || null,
                    allergies: data.allergies || null,
                    customerMessage: data.message || null,
                    lang: i18next.language,
                    recaptchaToken
                };

                try {
                    const response = await fetch('/create-request/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Une erreur est survenue.');
                    showNotification('Votre demande a été envoyée avec succès !');
                    bookingForm.reset();
                    fetchAndInitializeDatepicker();
                } catch (error) {
                    showNotification(`Erreur: ${error.message}`, 'error');
                } finally {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            });
        });
    });
}

function initializeLightbox() {
    document.body.addEventListener('click', (e) => {
        const galleryItem = e.target.closest('.gallery-item');
        if (!galleryItem) return;
        
        e.preventDefault();
        const imgSrc = galleryItem.querySelector('img').src;
        const imgAlt = galleryItem.querySelector('img').alt;
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `<div class="lightbox-bg" style="background-image: url(${imgSrc})"></div><div class="lightbox-content"><span class="lightbox-close">&times;</span><img src="${imgSrc}" alt="${imgAlt}" class="lightbox-image"></div>`;
        document.body.appendChild(lightbox);
        const closeLightbox = () => lightbox.remove();
        lightbox.addEventListener('click', (ev) => (ev.target === lightbox || ev.target.matches('.lightbox-close')) && closeLightbox());
    });
}

function initializeCookieConsent() {
    const banner = document.getElementById('cookie-consent-banner');
    if (!banner || localStorage.getItem('asiacuisine.re-cookie-consent') === 'true') return;
    
    setTimeout(() => banner.classList.add('is-visible'), 500);
    
    banner.addEventListener('click', (e) => {
        if (e.target.matches('#cookie-consent-accept, #cookie-consent-decline')) {
            localStorage.setItem('asiacuisine.re-cookie-consent', 'true');
            banner.classList.remove('is-visible');
        }
    });
}

async function initializeWelcomePopup() {
    const popup = document.getElementById('welcome-popup');
    if (!popup || sessionStorage.getItem('asiacuisine.re-welcome-shown') === 'true') return;

    try {
        const response = await fetch('/get-setting?key=welcomePopupMessage');
        if (response.ok) {
            const data = await response.json();
            if (data.value) document.getElementById('welcome-popup-message').textContent = data.value;
        }
    } catch (error) {
        console.error('Could not fetch welcome popup message:', error);
    }

    setTimeout(() => popup.classList.add('is-visible'), 1500);
    popup.addEventListener('click', (e) => {
        if (e.target.matches('#welcome-popup-close, #welcome-popup')) {
            popup.classList.remove('is-visible');
            sessionStorage.setItem('asiacuisine.re-welcome-shown', 'true');
        }
    });
}

function initializeSubscriptionForm() {
    const modal = document.getElementById('subscription-form-modal');
    if (!modal) return;

    const form = document.getElementById('subscription-form');
    const formulaNameEl = modal.querySelector('#selected-formula-name');
    const formulaInputEl = document.getElementById('form_formula');
    const messageDiv = document.getElementById('subscription-message');
    let selectedFormula = '';

    const openForm = (formula) => {
        selectedFormula = formula;
        if (formulaNameEl) formulaNameEl.textContent = formula;
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('is-visible'), 10);
        document.body.style.overflow = 'hidden';
    };

    const closeForm = () => {
        modal.classList.remove('is-visible');
        setTimeout(() => { modal.style.display = 'none'; }, 400);
        document.body.style.overflow = '';
        if (messageDiv) messageDiv.textContent = '';
    };

    document.querySelectorAll('.choose-button').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        openForm(e.target.dataset.formula);
    }));

    modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.matches('#close-subscription-modal-btn')) {
            e.preventDefault();
            closeForm();
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Envoi...';
        submitBtn.disabled = true;

        if (formulaInputEl) formulaInputEl.value = selectedFormula;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/create-subscription', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Une erreur est survenue.');
            messageDiv.textContent = 'Demande envoyée ! Nous vous contacterons bientôt.';
            messageDiv.className = 'mt-4 text-center text-green-600';
            form.reset();
            setTimeout(closeForm, 3000);
        } catch (error) {
            messageDiv.textContent = error.message;
            messageDiv.className = 'mt-4 text-center text-red-600';
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

function initializeWhatsAppLinks() {
    document.querySelectorAll('.js-whatsapp-link').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();

            const phone = this.dataset.phone;
            const message = "Bonjour, je souhaite commander..."; // Default message
            const encodedMessage = encodeURIComponent(message);

            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

            if (isIOS || isSafari) {
                const appLink = `whatsapp://send?phone=${phone}&text=${encodedMessage}`;
                const webLink = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;

                window.location.href = appLink;

                setTimeout(() => {
                    window.location.href = webLink;
                }, 1000);
            } else {
                window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
            }
        });
    });
}