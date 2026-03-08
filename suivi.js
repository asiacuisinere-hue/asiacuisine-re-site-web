document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('suivi-form');
    const resultDiv = document.getElementById('suivi-result');
    const requestIdInput = document.getElementById('request-id');

    // --- CONFIGURATION SUPABASE (Minimal pour le suivi) ---
    const SUPABASE_URL = "https://zgniojabjywrnwovlmaf.supabase.co";
    const SUPABASE_KEY = "VOTRE_CLE_ANON_ICI"; // À remplacer par votre clé anonyme réelle

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
            setTimeout(() => { playSplitFlap("Envie de poursuivre votre voyage ?", "split-flap-msg"); }, 800);
        } else if (status === 'cancel') {
            paymentIcon.innerHTML = '❌';
            paymentIcon.className = 'cancel-icon';
            paymentTitle.textContent = 'Paiement annulé';
            paymentMessage.textContent = 'L\'opération a été annulée. Vous pouvez retenter via le lien initial.';
        }

        let timeLeft = 25;
        const countdown = setInterval(() => {
            timeLeft--;
            if (timerSpan) timerSpan.textContent = timeLeft;
            if (timeLeft <= 0) { clearInterval(countdown); window.location.href = 'index.html'; }
        }, 1000);
    }

    function playSplitFlap(text, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        const chars = text.split('');
        chars.forEach((char, index) => {
            const flap = document.createElement('div');
            flap.className = 'flap-char';
            flap.textContent = '';
            if (char === ' ') flap.style.backgroundColor = 'transparent';
            container.appendChild(flap);
            setTimeout(() => {
                flap.classList.add('flap-anim');
                flap.textContent = char;
                setTimeout(() => flap.classList.remove('flap-anim'), 400);
            }, index * 80);
        });
    }

    // --- LOGIQUE DE SUIVI TEMPS RÉEL (STYLE UBER) ---
    let map = null;
    let chefMarker = null;
    let mapInitialized = false;

    async function initMap(lat, lng) {
        if (mapInitialized) return;
        
        // Charger CSS Leaflet
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Charger JS Leaflet
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
            const mapContainer = document.createElement('div');
            mapContainer.id = 'delivery-map';
            mapContainer.style.height = '300px';
            mapContainer.style.width = '100%';
            mapContainer.style.borderRadius = '20px';
            mapContainer.style.marginTop = '20px';
            mapContainer.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
            
            resultDiv.appendChild(mapContainer);

            map = L.map('delivery-map').setView([lat, lng], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);

            const chefIcon = L.icon({
                iconUrl: 'https://cdn-icons-png.flaticon.com/512/7541/7541900.png', // Icône Chef/Scooter
                iconSize: [40, 40],
                iconAnchor: [20, 40]
            });

            chefMarker = L.marker([lat, lng], { icon: chefIcon }).addTo(map)
                .bindPopup("<b>Le Chef est en route !</b>")
                .openPopup();
            
            mapInitialized = true;
            startLiveUpdates();
        };
        document.body.appendChild(script);
    }

    function startLiveUpdates() {
        // Simulation d'écoute Supabase sans charger la lib complète
        setInterval(async () => {
            try {
                const response = await fetch(`${SUPABASE_URL}/rest/v1/delivery_tracks?id=eq.chef-main-track&select=*`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const data = await response.json();
                if (data && data[0] && data[0].is_active) {
                    const { latitude, longitude } = data[0];
                    const newPos = [latitude, longitude];
                    chefMarker.setLatLng(newPos);
                    map.panTo(newPos);
                }
            } catch (e) { console.error("Update failed", e); }
        }, 10000); // Mise à jour toutes les 10s
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const requestId = requestIdInput.value.trim();
        if (!requestId || requestId.length < 8) return;

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<div class="spinner"></div><p>Récupération des informations...</p>';

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/demandes?id=ilike.${requestId}%&select=*,clients(first_name)`, {
                headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
            });
            const results = await response.json();
            const data = results[0];

            if (data) {
                let statusMsg = data.status;
                let color = "#d4af37";
                if (statusMsg === 'Prêt pour livraison') { statusMsg = "🚗 En cours de livraison"; color = "#28a745"; }

                resultDiv.innerHTML = `
                    <div style="border-left: 4px solid ${color}; padding-left: 20px;">
                        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900;">Bonjour ${data.clients?.first_name || 'Client'}</h3>
                        <p style="margin: 5px 0 20px 0; font-weight: 700; color: #888;">Commande #${data.id.substring(0,8)}</p>
                        <div style="background: white; padding: 15px; border-radius: 15px; display: inline-block; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                            Statut : <span style="color: ${color}; font-weight: 900; text-transform: uppercase;">${statusMsg}</span>
                        </div>
                    </div>
                `;

                // Si en livraison, on cherche la position du Chef
                if (data.status === 'Prêt pour livraison') {
                    const trackRes = await fetch(`${SUPABASE_URL}/rest/v1/delivery_tracks?id=eq.chef-main-track&select=*`, {
                        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                    });
                    const trackData = await trackRes.json();
                    if (trackData && trackData[0] && trackData[0].is_active) {
                        initMap(trackData[0].latitude, trackData[0].longitude);
                    } else {
                        resultDiv.innerHTML += `<p style="margin-top: 20px; font-size: 0.8rem; color: #aaa; italic">Le Chef prépare son départ...</p>`;
                    }
                }
            } else {
                resultDiv.innerHTML = '<p>Dossier non trouvé. Vérifiez votre numéro.</p>';
            }
        } catch (error) {
            resultDiv.innerHTML = `<p style="color: red;">Erreur de connexion.</p>`;
        }
    });
});
