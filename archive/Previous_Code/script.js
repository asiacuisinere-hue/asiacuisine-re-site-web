// --- MAIN INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all components once the document is ready
    initializeScrollBasedEffects();
    fetchAndInitializeDatepicker();
    initializeServiceMenu();
    initializeMobileMenu();
    initializeBackToTopButton();
    initializeGallery();
    initializeForm();
});

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
        const response = await fetch('/api/disponibilites');
        if (!response.ok) throw new Error(`Network response was not ok (${response.status})`);
        
        const data = await response.json();
        const unavailableDates = data.unavailableDates || [];

        new Datepicker(dateInput, {
            format: 'yyyy-mm-dd',
            language: 'fr',
            autohide: true,
            datesDisabled: unavailableDates,
            minDate: new Date(new Date().setDate(new Date().getDate() + 1)),
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

function initializeGallery() {
    let mySwiper = null;

    function swiperInit() {
        const screenWidth = window.innerWidth;
        if (screenWidth <= 768 && mySwiper === null) {
            mySwiper = new Swiper('.swiper', {
                loop: true,
                centeredSlides: true,
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
            });
        } else if (screenWidth > 768 && mySwiper !== null) {
            mySwiper.destroy(true, true);
            mySwiper = null;
        }
    }

    swiperInit();
    window.addEventListener('resize', swiperInit);
}

function initializeForm() {
    const bookingForm = document.getElementById('bookingForm');
    if (!bookingForm) return;

    bookingForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = this.querySelector('.submit-btn');
        const originalText = submitBtn.textContent;
        const formData = new FormData(this);
        const data = Object.fromEntries(formData.entries());
        
        if (!data.service || !data.date || !data.nom || !data.email) {
            alert('Veuillez remplir tous les champs obligatoires.');
            return;
        }

        submitBtn.textContent = 'Envoi en cours...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/reserver', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (response.ok) {
                alert('Votre demande de réservation a été envoyée avec succès ! Nous vous contacterons dans les plus brefs délais.');
                this.reset();
                fetchAndInitializeDatepicker(); 
            } else {
                alert(`Erreur: ${result.error || 'Une erreur inconnue est survenue.'}`);
            }
        } catch (error) {
            console.error('Submission Error:', error);
            alert('Une erreur de connexion est survenue. Veuillez réessayer.');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
}