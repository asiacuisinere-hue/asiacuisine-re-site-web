// --- SCRIPT INITIALIZATION ---

// Orchestrator function to ensure proper loading order
async function main() {
    console.log('DOM fully loaded and parsed');
    await initializeI18n(); // Wait for translations to be loaded
    console.log('i18next initialized, now initializing page content.');
    initializePageContent(); // Now run the rest of the page setup
}

document.addEventListener('DOMContentLoaded', main);


// --- I18N (TRANSLATION) LOGIC ---
async function initializeI18n() {
    console.log('Initializing i18next...');
    try {
        const frResponse = await fetch('./locales/fr.json');
        const enResponse = await fetch('./locales/en.json');
        const zhResponse = await fetch('./locales/zh.json');

        if (!frResponse.ok || !enResponse.ok || !zhResponse.ok) {
            throw new Error('Failed to fetch translation files');
        }

        const frTranslation = await frResponse.json();
        const enTranslation = await enResponse.json();
        const zhTranslation = await zhResponse.json();

        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get('lang') || 'fr';
        console.log(`Language detected from URL: ${lang}`);

        await i18next.init({
            lng: lang,
            debug: true, // Enable debug output from i18next
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
    console.log('Running updateContent()...');
    const elements = document.querySelectorAll('[data-i18n]');
    console.log(`Found ${elements.length} elements to translate.`);
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
    console.log(`Updating links to persist language: ${currentLang}`);
    document.querySelectorAll('a').forEach(link => {
        try {
            const url = new URL(link.href);
            if (link.hostname === window.location.hostname) {
                url.searchParams.set('lang', currentLang);
                link.href = url.href;
            }
        } catch (e) {
            // Ignore invalid URLs
        }
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
    // Functions that should run on ALL pages
    updateContent();
    createLanguageSwitcher();
    initializeCookieConsent();
    initializeWelcomePopup();
    fetchAndInitializeDatepicker(); // Moved to be called on all pages

    // Functions that should ONLY run on the main page (index.html)
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
}

function handleResponsiveLayout() {
    const switcher = document.querySelector('.language-switcher');
    const navContainer = document.querySelector('.nav-container');
    const navLinks = document.querySelector('.nav-links');
    const navToggle = document.querySelector('.nav-toggle');

    if (!switcher || !navContainer || !navLinks || !navToggle) return;

    if (window.innerWidth <= 800) {
        if (!navLinks.contains(switcher)) {
            navLinks.appendChild(switcher);
        }
    } else {
        if (!navContainer.contains(switcher)) {
            navContainer.insertBefore(switcher, navToggle);
        }
    }
}

// --- COMPONENT INITIALIZATION FUNCTIONS ---

function initializeScrollBasedEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            navbar.style.background = window.scrollY > 50 ? 'rgba(20, 20, 20, 0.98)' : 'rgba(20, 20, 20, 0.95)';
        }
        const parallax = document.querySelector('.hero');
        if (parallax) {
            parallax.style.transform = `translateY(${window.pageYOffset * 0.4}px)`;
        }
    }, { passive: true });
}

async function fetchAndInitializeDatepicker() {
    const dateInput = document.getElementById('date');
    if (!dateInput) return;

    try {
        const response = await fetch('/disponibilites');
        if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
        
        const data = await response.json();
console.log('--- [DEBUG] Disponibilités reçues:', data);
        const unavailableDates = data || [];

        new Datepicker(dateInput, {
            format: 'dd/mm/yyyy', // Display format
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

function initializeServiceMenu() {
    const flippablePages = document.querySelectorAll('.flippable-page');
    let currentFlippedIndex = 0;

    function updateMenuState() {
        flippablePages.forEach((page, index) => {
            if (index < currentFlippedIndex) {
                page.classList.add('is-flipped');
                page.style.zIndex = 10 + index;
            } else {
                page.classList.remove('is-flipped');
                page.style.zIndex = flippablePages.length - index;
            }
        });
    }

    function goToNextPage() {
        if (currentFlippedIndex < flippablePages.length) {
            currentFlippedIndex++;
            updateMenuState();
        }
    }

    function goToPrevPage() {
        if (currentFlippedIndex > 0) {
            currentFlippedIndex--;
            updateMenuState();
        }
    }

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
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }, { passive: true });
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('is-visible');
    }, 10);
    setTimeout(() => {
        notification.classList.remove('is-visible');
        notification.addEventListener('transitionend', () => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        });
    }, 4000);
}

function initializeForm() {
    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    const individualFieldsDiv = document.getElementById('particulier-fields');
    const companyFieldsDiv = document.getElementById('entreprise-fields');
    const individualRadio = document.getElementById('customer_type_individual');
    const companyRadio = document.getElementById('customer_type_company');

    // Function to toggle field visibility and required attributes
    const toggleCustomerFields = () => {
        const isIndividual = individualRadio.checked;

        individualFieldsDiv.style.display = isIndividual ? 'block' : 'none';
        companyFieldsDiv.style.display = isIndividual ? 'none' : 'block';

        // Set required attribute based on visibility
        individualFieldsDiv.querySelectorAll('input').forEach(input => input.required = isIndividual);
        companyFieldsDiv.querySelectorAll('input').forEach(input => input.required = !isIndividual);
    };

    // Initial call to set correct visibility and required attributes
    toggleCustomerFields();

    // Add event listeners to radio buttons
    individualRadio.addEventListener('change', toggleCustomerFields);
    companyRadio.addEventListener('change', toggleCustomerFields);


    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        let customerData = {};
        let requiredFieldsValid = true;

        if (data.customer_type === 'Particulier') {
            customerData = {
                firstName: null, // Assuming no separate first name field for now
                lastName: data.nom_particulier,
                email: data.email_particulier,
                phone: data.telephone_particulier
            };
            if (!data.nom_particulier || !data.email_particulier || !data.telephone_particulier) {
                requiredFieldsValid = false;
            }
        } else { // Entreprise
            customerData = {
                companyName: data.nom_entreprise,
                siret: data.siret,
                contactName: data.nom_contact_entreprise,
                contactEmail: data.email_contact_entreprise,
                contactPhone: data.telephone_contact_entreprise
            };
            if (!data.nom_entreprise || !data.siret || !data.nom_contact_entreprise || !data.email_contact_entreprise || !data.telephone_contact_entreprise) {
                requiredFieldsValid = false;
            }
        }

        if (!data.service || !data.date || !data.personnes || !requiredFieldsValid) {
            showNotification('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }

        submitBtn.textContent = 'Envoi en cours...';
        submitBtn.disabled = true;

        const requestPayload = {
            type: 'RESERVATION_SERVICE',
            customerType: data.customer_type,
            customer: customerData, // Use the dynamically built customerData
            requestDate: data.date,
            serviceType: data.service,
            numberOfPeople: data.personnes,
            customerMessage: data.message || null
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
                this.reset();
                fetchAndInitializeDatepicker(); // Re-initialize datepicker to refresh unavailable dates
            } else {
                showNotification(`Erreur: ${result.error || 'Une erreur inconnue est survenue.'}`, 'error');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            showNotification('Une erreur de connexion est survenue. Veuillez réessayer.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

function initializeLightbox() {
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const imgSrc = item.querySelector('img').src;
            const imgAlt = item.querySelector('img').alt;

            const lightbox = document.createElement('div');
            lightbox.classList.add('lightbox');

            const lightboxBg = document.createElement('div');
            lightboxBg.classList.add('lightbox-bg');
            lightboxBg.style.backgroundImage = `url(${imgSrc})`;

            const lightboxContent = document.createElement('div');
            lightboxContent.classList.add('lightbox-content');
            lightboxContent.innerHTML = `
                <span class="lightbox-close">&times;</span>
                <img src="${imgSrc}" alt="${imgAlt}" class="lightbox-image">
            `;

            lightbox.appendChild(lightboxBg);
            lightbox.appendChild(lightboxContent);
            document.body.appendChild(lightbox);

            const closeLightbox = () => {
                document.body.removeChild(lightbox);
            };

            lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', (e) => {
                // Close if clicking on the content area (the flex container), but not on the image itself
                if (e.target === lightboxContent) {
                    closeLightbox();
                }
            });
        });
    });
}

function initializeCookieConsent() {
    const banner = document.getElementById('cookie-consent-banner');
    const acceptBtn = document.getElementById('cookie-consent-accept');
    const declineBtn = document.getElementById('cookie-consent-decline');

    if (!banner || !acceptBtn || !declineBtn) {
        return;
    }

    const consentKey = 'asiacuisine.re-cookie-consent';

    if (localStorage.getItem(consentKey) === 'true') {
        banner.style.display = 'none';
        return;
    }

    setTimeout(() => {
        banner.classList.add('is-visible');
    }, 500);

    acceptBtn.addEventListener('click', () => {
        localStorage.setItem(consentKey, 'true');
        banner.classList.remove('is-visible');
    });

    declineBtn.addEventListener('click', () => {
        banner.classList.remove('is-visible');
    });
}

function initializeWelcomePopup() {
    const popup = document.getElementById('welcome-popup');
    const closeBtn = document.getElementById('welcome-popup-close');

    if (!popup || !closeBtn) {
        return;
    }

    const sessionKey = 'asiacuisine.re-welcome-shown';

    if (sessionStorage.getItem(sessionKey) === 'true') {
        popup.style.display = 'none';
        return;
    }

    setTimeout(() => {
        popup.classList.add('is-visible');
    }, 1500);

    const closePopup = () => {
        popup.classList.remove('is-visible');
        sessionStorage.setItem(sessionKey, 'true');
    };

    closeBtn.addEventListener('click', closePopup);
}


// --- I18N (TRANSLATION) LOGIC ---
async function initializeI18n() {
    console.log('Initializing i18next...');
    try {
        const frResponse = await fetch('./locales/fr.json');
        const enResponse = await fetch('./locales/en.json');
        const zhResponse = await fetch('./locales/zh.json');

        if (!frResponse.ok || !enResponse.ok || !zhResponse.ok) {
            throw new Error('Failed to fetch translation files');
        }

        const frTranslation = await frResponse.json();
        const enTranslation = await enResponse.json();
        const zhTranslation = await zhResponse.json();

        const urlParams = new URLSearchParams(window.location.search);
        const lang = urlParams.get('lang') || 'fr';
        console.log(`Language detected from URL: ${lang}`);

        await i18next.init({
            lng: lang,
            debug: true, // Enable debug output from i18next
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
    console.log('Running updateContent()...');
    const elements = document.querySelectorAll('[data-i18n]');
    console.log(`Found ${elements.length} elements to translate.`);
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
    console.log(`Updating links to persist language: ${currentLang}`);
    document.querySelectorAll('a').forEach(link => {
        try {
            const url = new URL(link.href);
            if (link.hostname === window.location.hostname) {
                url.searchParams.set('lang', currentLang);
                link.href = url.href;
            }
        } catch (e) {
            // Ignore invalid URLs
        }
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
    // Functions that should run on ALL pages
    updateContent();
    createLanguageSwitcher();
    initializeCookieConsent();
    initializeWelcomePopup();
    fetchAndInitializeDatepicker(); // Moved to be called on all pages

    // Functions that should ONLY run on the main page (index.html)
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
}

function handleResponsiveLayout() {
    const switcher = document.querySelector('.language-switcher');
    const navContainer = document.querySelector('.nav-container');
    const navLinks = document.querySelector('.nav-links');
    const navToggle = document.querySelector('.nav-toggle');

    if (!switcher || !navContainer || !navLinks || !navToggle) return;

    if (window.innerWidth <= 800) {
        if (!navLinks.contains(switcher)) {
            navLinks.appendChild(switcher);
        }
    } else {
        if (!navContainer.contains(switcher)) {
            navContainer.insertBefore(switcher, navToggle);
        }
    }
}

// --- COMPONENT INITIALIZATION FUNCTIONS ---

function initializeScrollBasedEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            navbar.style.background = window.scrollY > 50 ? 'rgba(20, 20, 20, 0.98)' : 'rgba(20, 20, 20, 0.95)';
        }
        const parallax = document.querySelector('.hero');
        if (parallax) {
            parallax.style.transform = `translateY(${window.pageYOffset * 0.4}px)`;
        }
    }, { passive: true });
}

async function fetchAndInitializeDatepicker() {
    const dateInput = document.getElementById('date');
    if (!dateInput) return;

    try {
        const response = await fetch('/disponibilites');
        if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
        
        const data = await response.json();
console.log('--- [DEBUG] Disponibilités reçues:', data);
        const unavailableDates = data || [];

        new Datepicker(dateInput, {
            format: 'dd/mm/yyyy', // Display format
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

function initializeServiceMenu() {
    const flippablePages = document.querySelectorAll('.flippable-page');
    let currentFlippedIndex = 0;

    function updateMenuState() {
        flippablePages.forEach((page, index) => {
            if (index < currentFlippedIndex) {
                page.classList.add('is-flipped');
                page.style.zIndex = 10 + index;
            } else {
                page.classList.remove('is-flipped');
                page.style.zIndex = flippablePages.length - index;
            }
        });
    }

    function goToNextPage() {
        if (currentFlippedIndex < flippablePages.length) {
            currentFlippedIndex++;
            updateMenuState();
        }
    }

    function goToPrevPage() {
        if (currentFlippedIndex > 0) {
            currentFlippedIndex--;
            updateMenuState();
        }
    }

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
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }, { passive: true });
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.classList.add('notification', type);
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('is-visible');
    }, 10);
    setTimeout(() => {
        notification.classList.remove('is-visible');
        notification.addEventListener('transitionend', () => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        });
    }, 4000);
}

function initializeForm() {
    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    const individualFieldsDiv = document.getElementById('particulier-fields');
    const companyFieldsDiv = document.getElementById('entreprise-fields');
    const individualRadio = document.getElementById('customer_type_individual');
    const companyRadio = document.getElementById('customer_type_company');

    // Function to toggle field visibility and required attributes
    const toggleCustomerFields = () => {
        const isIndividual = individualRadio.checked;

        individualFieldsDiv.style.display = isIndividual ? 'block' : 'none';
        companyFieldsDiv.style.display = isIndividual ? 'none' : 'block';

        // Set required attribute based on visibility
        individualFieldsDiv.querySelectorAll('input').forEach(input => input.required = isIndividual);
        companyFieldsDiv.querySelectorAll('input').forEach(input => input.required = !isIndividual);
    };

    // Initial call to set correct visibility and required attributes
    toggleCustomerFields();

    // Add event listeners to radio buttons
    individualRadio.addEventListener('change', toggleCustomerFields);
    companyRadio.addEventListener('change', toggleCustomerFields);


    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());

        let customerData = {};
        let requiredFieldsValid = true;

        if (data.customer_type === 'Particulier') {
            customerData = {
                firstName: null, // Assuming no separate first name field for now
                lastName: data.nom_particulier,
                email: data.email_particulier,
                phone: data.telephone_particulier
            };
            if (!data.nom_particulier || !data.email_particulier || !data.telephone_particulier) {
                requiredFieldsValid = false;
            }
        } else { // Entreprise
            customerData = {
                companyName: data.nom_entreprise,
                siret: data.siret,
                contactName: data.nom_contact_entreprise,
                contactEmail: data.email_contact_entreprise,
                contactPhone: data.telephone_contact_entreprise
            };
            if (!data.nom_entreprise || !data.siret || !data.nom_contact_entreprise || !data.email_contact_entreprise || !data.telephone_contact_entreprise) {
                requiredFieldsValid = false;
            }
        }

        if (!data.service || !data.date || !data.personnes || !requiredFieldsValid) {
            showNotification('Veuillez remplir tous les champs obligatoires.', 'error');
            return;
        }

        submitBtn.textContent = 'Envoi en cours...';
        submitBtn.disabled = true;

        const requestPayload = {
            type: 'RESERVATION_SERVICE',
            customerType: data.customer_type,
            customer: customerData, // Use the dynamically built customerData
            requestDate: data.date,
            serviceType: data.service,
            numberOfPeople: data.personnes,
            customerMessage: data.message || null
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
                this.reset();
                fetchAndInitializeDatepicker(); // Re-initialize datepicker to refresh unavailable dates
            } else {
                showNotification(`Erreur: ${result.error || 'Une erreur inconnue est survenue.'}`, 'error');
            }
        } catch (error) {
            console.error('Submission Error:', error);
            showNotification('Une erreur de connexion est survenue. Veuillez réessayer.', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}

function initializeLightbox() {
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const imgSrc = item.querySelector('img').src;
            const imgAlt = item.querySelector('img').alt;

            const lightbox = document.createElement('div');
            lightbox.classList.add('lightbox');

            const lightboxBg = document.createElement('div');
            lightboxBg.classList.add('lightbox-bg');
            lightboxBg.style.backgroundImage = `url(${imgSrc})`;

            const lightboxContent = document.createElement('div');
            lightboxContent.classList.add('lightbox-content');
            lightboxContent.innerHTML = `
                <span class="lightbox-close">&times;</span>
                <img src="${imgSrc}" alt="${imgAlt}" class="lightbox-image">
            `;

            lightbox.appendChild(lightboxBg);
            lightbox.appendChild(lightboxContent);
            document.body.appendChild(lightbox);

            const closeLightbox = () => {
                document.body.removeChild(lightbox);
            };

            lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
            lightbox.addEventListener('click', (e) => {
                // Close if clicking on the content area (the flex container), but not on the image itself
                if (e.target === lightboxContent) {
                    closeLightbox();
                }
            });
        });
    });
}

function initializeCookieConsent() {
    const banner = document.getElementById('cookie-consent-banner');
    const acceptBtn = document.getElementById('cookie-consent-accept');
    const declineBtn = document.getElementById('cookie-consent-decline');

    if (!banner || !acceptBtn || !declineBtn) {
        return;
    }

    const consentKey = 'asiacuisine.re-cookie-consent';

    if (localStorage.getItem(consentKey) === 'true') {
        banner.style.display = 'none';
        return;
    }

    setTimeout(() => {
        banner.classList.add('is-visible');
    }, 500);

    acceptBtn.addEventListener('click', () => {
        localStorage.setItem(consentKey, 'true');
        banner.classList.remove('is-visible');
    });

    declineBtn.addEventListener('click', () => {
        banner.classList.remove('is-visible');
    });
}

function initializeWelcomePopup() {
    const popup = document.getElementById('welcome-popup');
    const closeBtn = document.getElementById('welcome-popup-close');

    if (!popup || !closeBtn) {
        return;
    }

    const sessionKey = 'asiacuisine.re-welcome-shown';

    if (sessionStorage.getItem(sessionKey) === 'true') {
        popup.style.display = 'none';
        return;
    }

    setTimeout(() => {
        popup.classList.add('is-visible');
    }, 1500);

    const closePopup = () => {
        popup.classList.remove('is-visible');
        sessionStorage.setItem(sessionKey, 'true');
    };

    closeBtn.addEventListener('click', closePopup);
}