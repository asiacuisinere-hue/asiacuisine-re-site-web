document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('suivi-form');
    const resultDiv = document.getElementById('suivi-result');
    const requestIdInput = document.getElementById('request-id');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const requestId = requestIdInput.value.trim();
        if (!requestId || requestId.length !== 8) {
            resultDiv.innerHTML = '<p style="color: red;">Veuillez entrer un numéro de suivi valide à 8 caractères.</p>';
            resultDiv.style.display = 'block';
            return;
        }

        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<p>Recherche en cours...</p>';

        try {
            // The serverless function will be at /api/get-demande-status
            const response = await fetch(`/api/lookup-request?id=${requestId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Une erreur est survenue.');
            }

            if (data) {
                const createdDate = new Date(data.created_at).toLocaleDateString('fr-FR');
                resultDiv.innerHTML = `
                    <h3>Détails de la demande #${requestId}</h3>
                    <p><strong>Date de la demande :</strong> ${createdDate}</p>
                    <p><strong>Type :</strong> ${data.type}</p>
                    <p><strong>Statut :</strong> <span class="status-badge" style="padding: 4px 8px; border-radius: 12px; color: white; font-weight: bold; font-size: 12px; background-color: #6c757d;">${data.status}</span></p>
                    <p style="margin-top: 1rem; font-style: italic;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
                `;
            } else {
                resultDiv.innerHTML = '<p style="color: orange;">Aucune demande trouvée avec ce numéro de suivi. Veuillez vérifier le numéro et réessayer.</p>';
            }
        } catch (error) {
            resultDiv.innerHTML = `<p style="color: red;">Erreur : ${error.message}</p>`;
        }
    });
});
