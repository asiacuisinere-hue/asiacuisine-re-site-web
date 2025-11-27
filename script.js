// --- SCRIPT INITIALIZATION ---

async function main() {
    console.log('DOM fully loaded and parsed');
    await initializeI18n();
    console.log('i18next initialized, now initializing page content.');
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

        if (!frResponse.ok || !enResponse.ok || !zhResponse.ok) {
            throw new Error('Failed to fetch translation files');
        }

        const [frTranslation, enTranslation, zhTranslation] = await Promise.all([
            frResponse.json(),
            enResponse.json(),
            zhResponse.json()
        ]);

        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get('lang') || 'fr';

        await i18next.init({
            lng: lang,
            debug: true,
            resources: {
                fr: frTranslation,
                en: enTranslation,
                zh: zhTranslation
            }
        });
    } catch (error) {
        console.error('i18next initialization failed:', error);
    }
}

function updateContent() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.dataset.i18n;
        if (key.startsWith('[placeholder]')) {
            const placeholderKey = key.replace('[placeholder]', '');
            el.placeholder = i18next.t(placeholderKey);
        } else {
            el.innerHTML = i18next.t(key);
        }
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active-lang', btn.dataset.lang === i18next.language);
    });

    const currentLang = i18next.language;
    document.querySelectorAll('a').forEach(link => {
        try {
            const url = new URL(link.href);
            if (link.hostname === window.location.hostname) {
                url.searchParams.set('lang', currentLang);
                link.href = url.href;
            }
        } catch (e) { /* Ignore invalid URLs */ }
    });
}

function createLanguageSwitcher() {
    const navContainer = document.querySelector('.nav-container');
    if (!navContainer) return;

    const switcher = document.createElement('div');
    switcher.classList.add('language-switcher');
    switcher.innerHTML = `
        <button class="lang-btn" data-lang="fr">FR</button>
        <span style="color: #666;">|</span>
        <button class="lang-btn" data-lang="en">EN</button>
        <span style="color: #666;">|</span>
        <button class="lang-btn" data-lang="zh">ZH</button>
    `;

    const mobileToggle = document.querySelector('.nav-toggle');
    if (mobileToggle) {
        navContainer.insertBefore(switcher, mobileToggle);
    } else {
        navContainer.appendChild(switcher);
    }

    switcher.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const lang = e.target.dataset.lang;
            const url = new URL(window.location);
            url.searchParams.set('lang', lang);
            window.location.href = url.href;
        });
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
}

function handleResponsiveLayout() {
    const switcher = document.querySelector('.language-switcher');
    const navContainer = document.querySelector('.nav-container');
    const navLinks = document.querySelector('.nav-links');
    const navToggle = document.querySelector('.nav-toggle');

    if (!switcher || !navContainer || !navLinks || !navToggle) return;

    if (window.innerWidth <= 800) {
        if (!navLinks.contains(switcher)) navLinks.appendChild(switcher);
    } else {
        if (!navContainer.contains(switcher)) navContainer.insertBefore(switcher, navToggle);
    }
}

async function fetchAndInitializeDatepicker() {
    const dateInput = document.getElementById('date');
    if (!dateInput) return;

    try {
        const response = await fetch('/disponibilites?service_type=RESERVATION_SERVICE');
        if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
        
        const unavailableDates = await response.json() || [];

        new Datepicker(dateInput, {
            format: 'dd/mm/yyyy',
            language: 'fr',
            autohide: true,
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

function initializeForm() {
    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    function convertDateToISO(dateString) {
        if (!dateString) return null;
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateString;
    }

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
        if (typeof grecaptcha === 'undefined') {
            showNotification('Erreur de configuration de la sécurité.', 'error');
            return;
        }
        grecaptcha.ready(() => {
            grecaptcha.execute('%%RECAPTCHA_SITE_KEY%%', {action: 'submit'}).then(async (recaptchaToken) => {
                const formData = new FormData(this);
                const data = Object.fromEntries(formData.entries());
                const originalText = submitBtn.textContent;
                submitBtn.textContent = 'Envoi en cours...';
                submitBtn.disabled = true;

                const requestPayload = {
                    type: 'RESERVATION_SERVICE',
                    customerType: data.customer_type,
                    customer: data.customer_type === 'Particulier' ? {
                        lastName: data.nom_particulier, email: data.email_particulier, phone: data.telephone_particulier
                    } : {
                        companyName: data.nom_entreprise, siret: data.siret, contactName: data.nom_contact_entreprise,
                        contactEmail: data.email_contact_entreprise, contactPhone: data.telephone_contact_entreprise
                    },
                    requestDate: convertDateToISO(data.date),
                    serviceType: data.service,
                    numberOfPeople: data.personnes,
                    customerMessage: data.message || null,
                    recaptchaToken: recaptchaToken
                };

                try {
                    const response = await fetch('/create-request/', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestPayload),
                    });
                    const result = await response.json();
                    if (response.ok) {
                        showNotification('Votre demande a été envoyée avec succès !');
                        bookingForm.reset();
                        fetchAndInitializeDatepicker();
                    } else {
                        showNotification(`Erreur: ${result.error || 'Une erreur est survenue.'}`, 'error');
                    }
                } catch (error) {
                    showNotification('Erreur de connexion. Veuillez réessayer.', 'error');
                } finally {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            });
        });
    });
}

function initializeCookieConsent() {
    const banner = document.getElementById('cookie-consent-banner');
    const acceptBtn = document.getElementById('cookie-consent-accept');
    if (!banner || !acceptBtn) return;
    if (localStorage.getItem('asiacuisine.re-cookie-consent') === 'true') {
        banner.style.display = 'none';
        return;
    }
    banner.classList.add('is-visible');
    acceptBtn.addEventListener('click', () => {
        localStorage.setItem('asiacuisine.re-cookie-consent', 'true');
        banner.classList.remove('is-visible');
    });
    document.getElementById('cookie-consent-decline')?.addEventListener('click', () => {
        banner.classList.remove('is-visible');
    });
}

// Stubs for other functions to avoid breaking the script
function initializeScrollBasedEffects() {}
function initializeServiceMenu() {}
function initializeMobileMenu() {}
function initializeBackToTopButton() {}
function initializeLightbox() {}
async function initializeWelcomePopup() {}
function initializeSubscriptionForm() {}
