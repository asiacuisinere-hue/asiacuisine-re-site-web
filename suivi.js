document.addEventListener('DOMContentLoaded', () => {
    const statusContainer = document.getElementById('status-container');
    const params = new URLSearchParams(window.location.search);
    const demandId = params.get('id');

    if (!demandId) {
        statusContainer.innerHTML = '<p style="color: red;">ID de commande non trouvé dans l'URL.</p>';
        return;
    }

    // Redirect to the admin validation page with the demand ID
    const validationUrl = `https://gestion.asiacuisine.re/validation?id=${demandId}`;
    
    statusContainer.innerHTML = `<p>Redirection vers la page de validation...</p><p><a href="${validationUrl}">Cliquez ici si vous n'êtes pas redirigé.</a></p>`;

    window.location.href = validationUrl;
});