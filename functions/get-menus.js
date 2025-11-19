import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response, origin) => {
    const allowedOrigins = [
        'https://www.asiacuisine.re',
        'https://gestion.asiacuisine.re'
    ];
    
    if (allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
        // Fallback or default to avoid blocking all if origin is not in list
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

        // Liste des clés à récupérer
        const settingKeys = [
            'menu_decouverte',
            'menu_standard',
            'menu_confort',
            'menu_duo',
            'menu_override_message',
            'menu_override_enabled'
        ];

        // Récupérer tous les settings en une seule requête
        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', settingKeys);

        if (error) {
            console.error('Error fetching menu settings:', error);
            throw error;
        }

        // Transformer le tableau en objet
        const menuSettings = {};
        if (data) {
            data.forEach(setting => {
                menuSettings[setting.key] = setting.value;
            });
        }

        // Retourner des valeurs par défaut si aucune donnée n'est trouvée pour certaines clés
        const defaultSettings = {
            menu_decouverte: '',
            menu_standard: '',
            menu_confort: '',
            menu_duo: '',
            menu_override_message: '',
            menu_override_enabled: 'false'
        };

        const finalMenuSettings = { ...defaultSettings, ...menuSettings };


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
