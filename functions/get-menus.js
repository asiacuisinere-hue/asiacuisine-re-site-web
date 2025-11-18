
import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);

        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .like('key', 'menu_%'); // Fetch all settings where the key starts with "menu_"

        if (error) {
            console.error('Error fetching menu settings:', error);
            throw new Error('Failed to fetch menu settings.');
        }

        // Transform the array of {key, value} into a single object {key: value}
        const menuSettings = data.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {});

        return addCorsHeaders(new Response(JSON.stringify(menuSettings), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur dans get-menus ---');
        console.error('Message:', error.message);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}
