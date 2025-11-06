document.addEventListener('DOMContentLoaded', () => {
    const statusContainer = document.getElementById('status-container');
    const params = new URLSearchParams(window.location.search);
    const demandId = params.get('id');

    if (!demandId) {
        statusContainer.innerHTML = '<p style="color: red;">Aucun ID de commande fourni.</p>';
        return;
    }

    fetch(`/api/get-demande-status?id=${demandId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            statusContainer.innerHTML = `<p>Le statut de votre commande est : <strong>${data.status}</strong></p>`;
        })
        .catch(error => {
            statusContainer.innerHTML = `<p style="color: red;">Erreur lors de la récupération du statut : ${error.message}</p>`;
        });
});
