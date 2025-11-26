import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response, origin) => {
    const allowedOrigins = [
        'https://www.asiacuisine.re',
        'https://gestion.asiacuisine.re'
    ];
    
    if (allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
        response.headers.set('Access-Control-Allow-Origin', 'https://www.asiacuisine.re');
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    const origin = context.request.headers.get('Origin');
    
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }), origin);
    }
    
    if (context.request.method !== 'GET') {
        return addCorsHeaders(
            new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { 
                status: 405, 
                headers: { 'Allow': 'GET', 'Content-Type': 'application/json' } 
            }), 
            origin
        );
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);
        console.log('--- [DEBUG] get-menus function called ---');
        console.log('--- [DEBUG] Origin:', origin);

        // 1. Récupérer les settings de menu de la table 'settings'
        const settingKeys = [
            'menu_decouverte', 'menu_standard', 'menu_confort', 'menu_duo',
            'menu_override_message', 'menu_override_enabled'
        ];
        const { data: menuSettingsData, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', settingKeys);

        if (settingsError) {
            console.error('Error fetching menu settings:', settingsError);
            throw settingsError;
        }

        const menuSettings = {};
        if (menuSettingsData) {
            menuSettingsData.forEach(setting => {
                menuSettings[setting.key] = setting.value;
            });
        }

        // 2. Récupérer les paramètres de délai de commande de la table 'company_settings'
        const { data: companyData, error: companyError } = await supabase
            .from('company_settings')
            .select('order_cutoff_days, order_cutoff_hour')
            .limit(1)
            .single();

        if (companyError) {
            console.error('Error fetching company settings for cutoff dates:', companyError);
            // Ne pas bloquer l'exécution si ces paramètres manquent, utiliser des valeurs par défaut
        }

        // Valeurs par défaut
        const defaultSettings = {
            menu_decouverte: '',
            menu_standard: '',
            menu_confort: '',
            menu_duo: '',
            menu_override_message: '',
            menu_override_enabled: 'false',
            order_cutoff_days: 2, // Valeur par défaut
            order_cutoff_hour: 11  // Valeur par défaut
        };

        const finalMenuSettings = { 
            ...defaultSettings, 
            ...menuSettings,
            ...companyData // Surcharge les valeurs par défaut si elles existent dans company_settings
        };

        console.log('--- [DEBUG] get-menus: Returning settings ---', finalMenuSettings);
        
        return addCorsHeaders(
            new Response(JSON.stringify(finalMenuSettings), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }), 
            origin
        );

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans get-menus ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(
            new Response(JSON.stringify({ 
                error: 'Internal Server Error', 
                details: error.message 
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }), 
            origin
        );
    }
}