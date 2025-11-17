document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const adminContent = document.getElementById('admin-content');
    const loginForm = document.getElementById('login-form');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const bookingList = document.getElementById('booking-list');

    // New elements for Welcome Message
    const welcomeMessageInput = document.getElementById('welcome-message-input');
    const saveWelcomeMessageBtn = document.getElementById('save-welcome-message');
    const saveStatus = document.getElementById('save-status');

    let adminPassword = null;

    // 0. Add event listener for the save button
    saveWelcomeMessageBtn.addEventListener('click', handleSaveWelcomeMessage);

    // 1. Handle Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = passwordInput.value;
        loginError.textContent = '';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const result = await response.json();

            if (result.success) {
                adminPassword = password; // Store password for subsequent requests
                loginSection.style.display = 'none';
                adminContent.style.display = 'block';
                fetchAndDisplayBookings();
                fetchAndDisplayWelcomeMessage(); // Fetch the welcome message
            } else {
                loginError.textContent = result.message || 'Erreur de connexion.';
            }
        } catch (error) {
            loginError.textContent = 'Une erreur de réseau est survenue.';
        }
    });

    // New function to fetch and display the welcome message
    async function fetchAndDisplayWelcomeMessage() {
        try {
            const response = await fetch('/functions/get-setting?key=welcomePopupMessage');
            // No auth needed for GET

            if (response.ok) {
                const data = await response.json();
                if (data.value) {
                    welcomeMessageInput.value = data.value;
                }
            } else if (response.status === 404) {
                // Key doesn't exist yet, which is fine.
                welcomeMessageInput.value = '';
            } 
            else {
                console.error('Failed to fetch welcome message');
            }
        } catch (error) {
            console.error('Error fetching welcome message:', error);
        }
    }

    // New function to handle saving the welcome message
    async function handleSaveWelcomeMessage() {
        if (!adminPassword) return;

        const message = welcomeMessageInput.value;
        saveStatus.textContent = 'Enregistrement...';
        saveStatus.style.color = '#333';

        try {
            const response = await fetch('/api/update-setting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: adminPassword,
                    key: 'welcomePopupMessage',
                    value: message
                })
            });

            const result = await response.json();

            if (result.success) {
                saveStatus.textContent = 'Message enregistré avec succès !';
                saveStatus.style.color = 'green';
            } else {
                throw new Error(result.message || 'Failed to save message.');
            }
        } catch (error) {
            saveStatus.textContent = `Erreur: ${error.message}`;
            saveStatus.style.color = 'red';
            console.error('Error saving welcome message:', error);
        }
    }


    // 2. Fetch and Display Bookings
    async function fetchAndDisplayBookings() {
        if (!adminPassword) return;

        try {
            const response = await fetch('/api/get-bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: adminPassword })
            });

            if (!response.ok) {
                throw new Error('Authentication failed or server error.');
            }

            const { bookings } = await response.json();
            bookingList.innerHTML = ''; // Clear the list

            if (bookings.length === 0) {
                bookingList.innerHTML = '<li>Aucune réservation pour le moment.</li>';
                return;
            }

            bookings.forEach(booking => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div>
                        <strong>${booking.booking_date}</strong> - ${booking.name} (${booking.email})
                        <br>
                        <small>Service: ${booking.service} | Personnes: ${booking.personnes || 'N/A'}</small>
                    </div>
                    <button class="delete-btn" data-id="${booking.id}">Annuler</button>
                `;
                bookingList.appendChild(li);
            });

            // Add event listeners to new delete buttons
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', handleDelete);
            });

        } catch (error) {
            bookingList.innerHTML = '<li>Erreur de chargement des réservations.</li>';
            console.error(error);
        }
    }

    // 3. Handle Deletion
    async function handleDelete(e) {
        const bookingId = e.target.dataset.id;
        
        if (!confirm('Êtes-vous sûr de vouloir annuler cette réservation ? Cette action est irréversible.')) {
            return;
        }

        try {
            const response = await fetch('/api/delete-booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: adminPassword, id: bookingId })
            });

            if (!response.ok) {
                throw new Error('Failed to delete booking.');
            }

            // Refresh the list to show the change
            fetchAndDisplayBookings();

        } catch (error) {
            alert('Erreur lors de la suppression.');
            console.error(error);
        }
    }
});