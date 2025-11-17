
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
        const url = new URL(context.request.url);
        const settingKey = url.searchParams.get('key');

        if (!settingKey) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Setting key is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
        }

        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', settingKey)
            .single();

        if (error || !data) {
            // If the setting is not found, it's not a server error. Return a specific "not found" message.
            if (error && error.code === 'PGRST116') { // PostgREST error code for "exact one row not found"
                 return addCorsHeaders(new Response(JSON.stringify({ value: null, message: 'Setting not found.' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
            }
            // For other errors, log them and return a server error.
            console.error(`Error fetching setting for key "${settingKey}":`, error);
            throw new Error('Failed to fetch setting.');
        }

        return addCorsHeaders(new Response(JSON.stringify({ value: data.value }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur dans get-setting ---');
        console.error('Message:', error.message);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}
