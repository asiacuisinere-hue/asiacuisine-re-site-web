// --- SCRIPT INITIALIZATION ---

async function main() {
    // 1. Maintenance Mode Check
    if (!window.location.pathname.includes('maintenance.html')) {
        try {
            const mResponse = await fetch('/get-setting?key=maintenance_mode');
            if (mResponse.ok) {
                const mData = await mResponse.json();
                if (mData.value === 'true') {
                    window.location.href = 'maintenance.html';
                    return;
                }
            }
        } catch (e) { console.warn('Maintenance check skipped'); }
    }

    // 2. I18n & Content
    await initializeI18n();
    initializePageContent();
}

document.addEventListener('DOMContentLoaded', main);

// --- I18N (TRANSLATION) LOGIC ---
async function initializeI18n() {
    try {
        const [frR, enR, zhR] = await Promise.all([
            fetch('./locales/fr.json'),
            fetch('./locales/en.json'),
            fetch('./locales/zh.json')
        ]);
        const resources = {
            fr: await frR.json(),
            en: await enR.json(),
            zh: await zhR.json()
        };
        const lang = new URLSearchParams(window.location.search).get('lang') || 'fr';
        await i18next.init({
            lng: lang,
            debug: false,
            resources: resources
        });
    } catch (error) {
        console.error('i18next initialization failed:', error);
    }
}

function updateContent() {
    if (typeof i18next === 'undefined' || !i18next.t) return;
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        try {
            if (key.startsWith('[placeholder]')) {
                el.placeholder = i18next.t(key.replace('[placeholder]', ''));
            } else {
                el.innerHTML = i18next.t(key);
            }
        } catch (e) { console.error('Translation error', e); }
    });
    
    document.querySelectorAll('.lang-btn').forEach(btn => 
        btn.classList.toggle('active-lang', btn.dataset.lang === i18next.language)
    );
}

// --- UI COMPONENTS ---

function createLanguageSwitcher() {
    const navContainer = document.querySelector('.nav-container');
    if (!navContainer) return;
    
    const switcher = document.createElement('div');
    switcher.className = 'language-switcher';
    switcher.innerHTML = `
        <div id="push-nav-control" class="push-nav-item"></div>
        <div class="lang-group">
            <button class="lang-btn" data-lang="fr">FR</button> | 
            <button class="lang-btn" data-lang="en">EN</button> | 
            <button class="lang-btn" data-lang="zh">文</button>
        </div>
    `;
    
    const mobileToggle = document.querySelector('.nav-toggle');
    navContainer.insertBefore(switcher, mobileToggle || null);
    
    switcher.addEventListener('click', (e) => {
        if (e.target.matches('.lang-btn')) {
            const url = new URL(window.location);
            url.searchParams.set('lang', e.target.dataset.lang);
            window.location.href = url.toString();
        }
    });
}

function initializePageContent() {
    updateContent();
    createLanguageSwitcher();
    initializeCookieConsent();
    initializeWelcomePopup();
    initializePushControl();
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
    initializeWhatsAppLinks();
    initializeCgvModal();
}

async function fetchAndInitializeDatepicker() {
    const dateInput = document.getElementById('date');
    if (!dateInput || typeof Datepicker === 'undefined') return;
    
    try {
        const response = await fetch('/disponibilites?service_type=RESERVATION_SERVICE');
        const data = await response.json();
        const unavailableDates = data.unavailableDates || [];
        
        const currentLang = i18next.language || 'fr';
        const datepickerLang = currentLang === 'zh' ? 'zh-CN' : currentLang;

        new Datepicker(dateInput, {
            format: 'dd/mm/yyyy',
            language: datepickerLang,
            autohide: true,
            datesDisabled: unavailableDates,
            minDate: new Date(new Date().setDate(new Date().getDate() + 7)),
            showDaysInNextAndPreviousMonths: false
        });
    } catch (error) {
        console.error('Datepicker init failed', error);
    }
}

function initializeScrollBasedEffects() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) el.classList.add('visible');
    });
}

function initializeForm() {
    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    const convertDateToISO = (s) => {
        if (!s) return null;
        const p = s.split('/');
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s;
    };

    const individualRadio = document.getElementById('customer_type_individual');
    const companyRadio = document.getElementById('customer_type_company');
    const individualFields = document.getElementById('particulier-fields');
    const companyFields = document.getElementById('entreprise-fields');

    const toggleFields = () => {
        const isInd = individualRadio.checked;
        individualFields.style.display = isInd ? 'block' : 'none';
        companyFields.style.display = isInd ? 'none' : 'block';
        
        const bizOption = document.getElementById('service-business');
        if (bizOption) bizOption.style.display = isInd ? 'none' : 'block';
    };

    if (individualRadio && companyRadio) {
        individualRadio.addEventListener('change', toggleFields);
        companyRadio.addEventListener('change', toggleFields);
        
        // Auto-select from Pro page
        if (localStorage.getItem('booking_type_default') === 'entreprise') {
            companyRadio.checked = true;
            localStorage.removeItem('booking_type_default');
        }
        toggleFields();
    }

    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('.submit-btn');
        if (typeof grecaptcha === 'undefined') return showNotification('Security Error', 'error');

        grecaptcha.ready(() => {
            grecaptcha.execute('6LdkdoUsAAAAAHekHonAf0ngnfTgq8xs-9Xxjvla', {action: 'submit'}).then(async (token) => {                const formData = new FormData(this);
                const data = Object.fromEntries(formData.entries());
                const originalText = submitBtn.textContent;
                
                submitBtn.textContent = 'Envoi...';
                submitBtn.disabled = true;

                let pushSub = null;
                try {
                    const reg = await navigator.serviceWorker.ready;
                    pushSub = await reg.pushManager.getSubscription();
                } catch (e) {}

                const payload = {
                    type: 'RESERVATION_SERVICE',
                    customerType: data.customer_type,
                    customer: data.customer_type === 'Particulier' 
                        ? { lastName: data.nom_particulier, email: data.email_particulier, phone: data.telephone_particulier }
                        : { companyName: data.nom_entreprise, siret: data.siret, contactName: data.nom_contact_entreprise, contactEmail: data.email_contact_entreprise, contactPhone: data.telephone_contact_entreprise },
                    requestDate: convertDateToISO(data.date),
                    lang: i18next.language,
                    recaptchaToken: token,
                    pushSubscription: pushSub ? pushSub.toJSON() : null,
                    details_json: {
                        serviceType: data.service,
                        heure: data.heure,
                        numberOfPeople: data.personnes,
                        ville: data.ville,
                        budget: data.budget || null,
                        allergies: data.allergies || null,
                        customerMessage: data.message || null
                    }
                };

                try {
                    const res = await fetch('/create-request', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error('Error');
                    showNotification('Demande envoyée !');
                    bookingForm.reset();
                } catch (err) {
                    showNotification('Erreur lors de l\'envoi', 'error');
                } finally {
                    submitBtn.textContent = originalText;
                    submitBtn.disabled = false;
                }
            });
        });
    });
}

// --- PUSH LOGIC ---

async function initializePushControl() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const container = document.getElementById('push-nav-control');
    if (!container) return;

    const updateState = (isSub) => {
        container.classList.toggle('subscribed', isSub);
        const icon = isSub ? '🔕' : '🔔';
        const title = isSub ? i18next.t('push.title_unsubscribe') : i18next.t('push.title_subscribe');
        container.innerHTML = `<span title="${title}">${icon}</span>`;
    };

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    updateState(!!sub);

    container.addEventListener('click', async () => {
        if (sub) {
            if (!confirm(i18next.t('push.confirm_unsubscribe'))) return;
            await sub.unsubscribe();
            sub = null;
            updateState(false);
        } else {
            await subscribeClientToPush();
            sub = await reg.pushManager.getSubscription();
            if (sub) updateState(true);
        }
    });
}

async function subscribeClientToPush() {
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array("BLjAkonu9QmbdntAaPmgfo0H_9qCHZ-MDnzLZnDtwZz077Nlhte6gptHMrg5hU7dZzw9XnKa6gd7zpKeDEz19VA")
        });
        
        await fetch('https://zgniojabjywrnwovlmaf.supabase.co/rest/v1/push_subscriptions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'apikey': 'VOTRE_CLE_ANON_REELLE',
                'Authorization': 'Bearer VOTRE_CLE_ANON_REELLE'
            },
            body: JSON.stringify({ subscription: sub.toJSON(), role: 'customer' })
        });
    } catch (e) { console.error('Push failed', e); }
}

// --- UTILS ---

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
}

function handleResponsiveLayout() {
    const switcher = document.querySelector('.language-switcher');
    const container = document.querySelector('.nav-container');
    const toggle = document.querySelector('.nav-toggle');
    if (switcher && container && toggle) container.insertBefore(switcher, toggle);
}

function initializeWhatsAppLinks() {
    document.querySelectorAll('.js-whatsapp-link').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const phone = this.dataset.phone;
            const msg = encodeURIComponent("Bonjour, je souhaite commander...");
            const url = /iPad|iPhone|iPod/.test(navigator.userAgent) ? `whatsapp://send?phone=${phone}&text=${msg}` : `https://wa.me/${phone}?text=${msg}`;
            window.open(url, '_blank');
        });
    });
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

function initializeWelcomePopup() {
    const popup = document.getElementById('welcome-popup');
    if (!popup || sessionStorage.getItem('asiacuisine.re-welcome-shown') === 'true') return;

    fetch('/get-setting?key=welcomePopupMessage')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data && data.value) document.getElementById('welcome-popup-message').textContent = data.value;
            setTimeout(() => popup.classList.add('is-visible'), 1500);
        })
        .catch(err => console.error('Welcome popup failed', err));

    popup.addEventListener('click', (e) => {
        if (e.target.matches('#welcome-popup-close, #welcome-popup')) {
            popup.classList.remove('is-visible');
            sessionStorage.setItem('asiacuisine.re-welcome-shown', 'true');
        }
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

function initializeCgvModal() {
    const modal = document.getElementById('cgv-modal');
    const cgvBody = document.getElementById('cgv-content-body');
    const closeBtns = document.querySelectorAll('.close-modal');

    document.body.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'open-cgv-link') {
            e.preventDefault();
            if (modal) modal.classList.add('is-visible');
            if (cgvBody && (cgvBody.innerHTML.includes("Chargement") || cgvBody.innerHTML === "")) {      
                fetch('cgv.html')
                    .then(res => res.text())
                    .then(html => {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');
                        cgvBody.innerHTML = (doc.querySelector('.legal-container') || doc.querySelector('main') || doc.body).innerHTML;
                        if (window.i18next && typeof i18next.t === 'function') {
                            cgvBody.querySelectorAll('[data-i18n]').forEach(el => {
                                const key = el.getAttribute('data-i18n');
                                if (key) el.innerHTML = i18next.t(key);
                            });
                        }
                    })
                    .catch(() => { cgvBody.innerHTML = "Erreur chargement CGV."; });
            }
        }
    });
    closeBtns.forEach(btn => btn.addEventListener('click', () => modal?.classList.remove('is-visible'))); 
}

function initializeLightbox() {
    document.body.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item');
        if (!item) return;
        e.preventDefault();
        const img = item.querySelector('img');
        const lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `<div class="lightbox-bg" style="background-image: url(${img.src})"></div><div class="lightbox-content"><span class="lightbox-close">&times;</span><img src="${img.src}" alt="${img.alt}" class="lightbox-image"></div>`;
        document.body.appendChild(lightbox);
        lightbox.addEventListener('click', (ev) => (ev.target === lightbox || ev.target.matches('.lightbox-close')) && lightbox.remove());
    });
}

function initializeMobileMenu() {
    const toggle = document.querySelector('.nav-toggle');
    const links = document.querySelector('.nav-links');
    if (toggle && links) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            links.classList.toggle('active');
        });
    }
}

function initializeBackToTopButton() {
    const btn = document.getElementById('back-to-top-btn');
    if (btn) window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 300), { passive: true });
}

function initializeServiceMenu() {
    const pages = document.querySelectorAll('.flippable-page');
    let current = 0;
    const update = () => pages.forEach((p, i) => {
        p.classList.toggle('is-flipped', i < current);
        p.style.zIndex = i < current ? 10 + i : pages.length - i;
    });
    pages.forEach(p => {
        p.querySelector('.page-front')?.addEventListener('click', () => { if(current < pages.length) { current++; update(); } });
        p.querySelector('.page-back')?.addEventListener('click', () => { if(current > 0) { current--; update(); } });
    });
    update();
}

function initializeSubscriptionForm() {
    const modal = document.getElementById('subscription-form-modal');
    if (!modal) return;
    const form = document.getElementById('subscription-form');
    document.querySelectorAll('.choose-button').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('is-visible'), 10);
    }));
    modal.addEventListener('click', (e) => (e.target === modal || e.target.id === 'close-subscription-modal-btn') && modal.classList.remove('is-visible'));
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('SW Error', err));
    });
}
