// Configuration pour le journal de suivi client
const SUPABASE_URL = "https://zgniojabjywrnwovlmaf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnbmlvamFianl3cm53b3ZsbWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE0ODg2MzgsImV4cCI6MjA3NzA2NDYzOH0.W2oBIE4AkBEfi2k3apLK3Gr2bn22vKqQG2sTixQVPu0";

let supabaseClient;
let abonnementId = null;
let clientName = "";

async function initSuivi() {
    const urlParams = new URLSearchParams(window.location.search);
    const key = urlParams.get('key');

    if (!key) {
        document.body.innerHTML = "<div style='padding:3rem; text-align:center; font-family:sans-serif;'><h1 style='color:red;'>⚠️ Lien Invalide</h1><p>Veuillez utiliser le lien personnel envoyé par le Chef sur WhatsApp.</p></div>";
        return;
    }

    try {
        // Initialisation Supabase
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 1. Vérifier le jeton et récupérer l'abonnement
        const { data: abonnement, error: subError } = await supabaseClient
            .from('abonnements')
            .select('id, client_id, clients(first_name, last_name)')
            .eq('tracking_token', key)
            .single();

        if (subError || !abonnement) throw new Error("Abonnement introuvable ou lien expiré.");

        abonnementId = abonnement.id;
        clientName = `${abonnement.clients.first_name} ${abonnement.clients.last_name}`;
        document.getElementById('client-name').textContent = clientName;

        // 2. Charger l'historique
        loadHistory();

        // Masquer le chargement
        document.getElementById('loading-overlay').style.display = 'none';

    } catch (err) {
        console.error(err);
        document.getElementById('loading-overlay').innerHTML = `
            <div style="text-align:center; padding:2rem;">
                <p style='color:red; font-weight:bold;'>Erreur de connexion</p>
                <p style="font-size:0.8rem; color:#666;">${err.message}</p>
                <button onclick="location.reload()" style="margin-top:1rem; padding:10px 20px; border-radius:10px; border:none; background:#d4af37; color:white; font-weight:bold;">Réessayer</button>
            </div>
        `;
    }
}

async function loadHistory() {
    const { data: logs } = await supabaseClient
        .from('abonnement_journal_client')
        .select('*')
        .eq('abonnement_id', abonnementId)
        .order('date_saisie', { ascending: false })
        .limit(5);

    const historyList = document.getElementById('history-list');
    if (logs && logs.length > 0) {
        historyList.innerHTML = logs.map(log => `
            <div class="history-item">
                <div class="history-date">${new Date(log.date_saisie).toLocaleDateString('fr-FR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                <div class="history-content">${log.repas_contenu}</div>
                ${log.poids_actuel ? `<div style="font-size:0.7rem; font-weight:bold; color:#3b82f6; margin-top:4px;">Poids : ${log.poids_actuel} kg</div>` : ''}
            </div>
        `).join('');
    } else {
        historyList.innerHTML = "<p style='font-size:0.8rem; color:#ccc; font-style:italic;'>Aucune saisie récente.</p>";
    }
}

document.getElementById('submit-btn').addEventListener('click', async () => {
    const btn = document.getElementById('submit-btn');
    const content = document.getElementById('repas_contenu').value;
    
    if (!content.trim()) {
        alert("Veuillez noter ce que vous avez consommé.");
        return;
    }

    const payload = {
        abonnement_id: abonnementId,
        repas_contenu: content,
        niveau_satiete: parseInt(document.getElementById('niveau_satiete').value),
        energie_ressentie: parseInt(document.getElementById('energie_ressentie').value),
        poids_actuel: document.getElementById('poids_actuel').value ? parseFloat(document.getElementById('poids_actuel').value) : null,
        notes_client: document.getElementById('notes_client').value
    };

    btn.disabled = true;
    btn.innerHTML = "ENVOI EN COURS...";

    try {
        const { error } = await supabaseClient.from('abonnement_journal_client').insert([payload]);
        if (error) throw error;

        document.getElementById('form-container').style.display = 'none';
        document.getElementById('success-screen').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        alert("Erreur lors de l'envoi : " + err.message);
        btn.disabled = false;
        btn.textContent = "TRANSMETTRE AU CHEF";
    }
});

// Lancement
initSuivi();
