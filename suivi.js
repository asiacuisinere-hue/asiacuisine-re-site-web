document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('suivi-form');
    const resultDiv = document.getElementById('suivi-result');
    const requestIdInput = document.getElementById('request-id');

    // --- Gestion du statut de paiement ---
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const paymentCard = document.getElementById('payment-status-card');
    const paymentIcon = document.getElementById('payment-icon');
    const paymentTitle = document.getElementById('payment-title');
    const paymentMessage = document.getElementById('payment-message');
    const crossSellSection = document.getElementById('cross-sell-section');
    const timerSpan = document.getElementById('timer');
    const pageTitle = document.getElementById('page-title');
    const pageDesc = document.getElementById('page-desc');

    if (status) {
        paymentCard.style.display = 'block';
        if (pageTitle) pageTitle.style.display = 'none';
        if (pageDesc) pageDesc.style.display = 'none';
        if (form) form.style.display = 'none';
        
        if (status === 'success') {
            paymentIcon.innerHTML = '✅';
            paymentIcon.className = 'success-icon';
            paymentTitle.textContent = 'Paiement confirmé !';
            paymentMessage.textContent = 'Votre règlement a été validé. Merci pour votre confiance.';
            
            crossSellSection.style.display = 'block';
            
            // --- LANCEMENT ANIMATION SPLIT-FLAP ---
            setTimeout(() => {
                playSplitFlap("Envie de poursuivre votre voyage ?", "split-flap-msg");
            }, 800);

        } else if (status === 'cancel') {
            paymentIcon.innerHTML = '❌';
            paymentIcon.className = 'cancel-icon';
            paymentTitle.textContent = 'Paiement annulé';
            paymentMessage.textContent = 'L\'opération a été annulée. Vous pouvez retenter via le lien initial.';
        }

        let timeLeft = 25; // Plus de temps pour apprécier l'animation
        const countdown = setInterval(() => {
            timeLeft--;
            if (timerSpan) timerSpan.textContent = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(countdown);
                window.location.href = 'index.html';
            }
        }, 1000);
    }

    // --- MOTEUR SPLIT-FLAP ---
    function playSplitFlap(text, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = ''; // Clear
        const chars = text.split('');
        
        chars.forEach((char, index) => {
            const flap = document.createElement('div');
            flap.className = 'flap-char';
            flap.textContent = ''; // Vide au début
            if (char === ' ') flap.style.backgroundColor = 'transparent';
            container.appendChild(flap);

            // Animation en décalé pour chaque lettre
            setTimeout(() => {
                flap.classList.add('flap-anim');
                flap.textContent = char;
                // On retire la classe après l'anim pour pouvoir la rejouer si besoin
                setTimeout(() => flap.classList.remove('flap-anim'), 400);
            }, index * 80); // 80ms entre chaque lettre
        });
    }

    // --- Formulaire de suivi classique ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const requestId = requestIdInput.value.trim();
        if (!requestId || requestId.length !== 8) return;

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p>Recherche...</p>';

        try {
            const response = await fetch(`/api/lookup-request?id=${requestId}`);
            const data = await response.json();
            if (data) {
                resultDiv.innerHTML = `<h3>Demande #${requestId}</h3><p>Statut : <strong>${data.status}</strong></p>`;
            } else {
                resultDiv.innerHTML = '<p>Non trouvée.</p>';
            }
        } catch (error) {
            resultDiv.innerHTML = `<p style="color: red;">Erreur serveur.</p>`;
        }
    });
});