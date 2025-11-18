document.addEventListener('DOMContentLoaded', () => {
    const fetchMenuContents = async () => {
        try {
            // Use the production URL directly as this is for the public-facing site
            const response = await fetch('/get-menus');
            
            if (!response.ok) {
                // Don't throw an error, just log it, so the page doesn't break if API is down
                console.error('Failed to fetch menu contents:', response.statusText);
                return;
            }

            const menus = await response.json();

            const menuMapping = {
                'menu_decouverte': { id: 'content-decouverte', label: 'Menu Découverte' },
                'menu_standard': { id: 'content-standard', label: 'Formule Standard' },
                'menu_confort': { id: 'content-confort', label: 'Formule Confort' },
                'menu_duo': { id: 'content-duo', label: 'Option Duo' }
            };

            for (const key in menuMapping) {
                const element = document.getElementById(menuMapping[key].id);
                const content = menus[key];

                if (element && content) {
                    element.innerHTML = `<strong>${menuMapping[key].label}:</strong> ${content}`;
                } else if (element) {
                    // Hide the paragraph if there's no content for it
                    element.style.display = 'none';
                }
            }

        } catch (error) {
            console.error('Error fetching or processing menu contents:', error);
        }
    };

    fetchMenuContents();
});
