document.addEventListener('DOMContentLoaded', () => {
    const fetchMenuContents = async () => {
        try {
            const response = await fetch('/get-menus');
            
            if (!response.ok) {
                console.error('Failed to fetch menu contents:', response.statusText);
                return;
            }

            const menus = await response.json();
            const contentContainer = document.getElementById('weekly-menu-content');

            if (!contentContainer) return;

            // Check if the override message is enabled and has content
            if (menus.menu_override_enabled === 'true' && menus.menu_override_message) {
                // Display only the override message
                contentContainer.innerHTML = `<p style="font-weight: bold; color: #c0392b; white-space: pre-wrap;">${menus.menu_override_message}</p>`;
            } else {
                // Otherwise, display the regular menu details
                const menuMapping = {
                    'menu_decouverte': { id: 'content-decouverte', label: 'Menu Découverte' },
                    'menu_standard': { id: 'content-standard', label: 'Formule Standard' },
                    'menu_confort': { id: 'content-confort', label: 'Formule Confort' },
                    'menu_duo': { id: 'content-duo', label: 'Option Duo' }
                };

                let hasContent = false;
                for (const key in menuMapping) {
                    const element = document.getElementById(menuMapping[key].id);
                    const content = menus[key];

                    if (element && content) {
                        element.innerHTML = `<strong>${menuMapping[key].label}:</strong> <span style="white-space: pre-wrap;">${content}</span>`;
                        hasContent = true;
                    } else if (element) {
                        element.style.display = 'none';
                    }
                }

                // If no menu content is set at all, hide the container
                if (!hasContent) {
                    contentContainer.style.display = 'none';
                }
            }

        } catch (error) {
            console.error('Error fetching or processing menu contents:', error);
        }
    };

    fetchMenuContents();
});
