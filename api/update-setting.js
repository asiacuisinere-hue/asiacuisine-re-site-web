
import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    // Handle CORS preflight requests
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*', // Adjust in production
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Allow': 'POST' } });
    }

    const headers = {
        'Access-Control-Allow-Origin': '*', // Adjust in production
        'Content-Type': 'application/json',
    };

    try {
        // 1. Initialize Supabase client
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 2. Authenticate with JWT
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ success: false, message: 'Authorization header is missing or invalid.' }), { status: 401, headers });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(JSON.stringify({ success: false, message: 'Authentication failed.', details: userError?.message }), { status: 401, headers });
        }

        // User is authenticated, proceed.
        const { key, value } = await context.request.json();

        // 3. Validate input
        if (!key || value === undefined) { // Allow empty string for value
            return new Response(JSON.stringify({ success: false, message: 'Setting key and value are required.' }), { status: 400, headers });
        }

        // 4. Upsert the setting
        const { data, error: upsertError } = await supabase
            .from('settings')
            .upsert({ key: key, value: value }, { onConflict: 'key' })
            .select() // Ensure the upserted data is returned
            .single();

        if (upsertError) {
            console.error('Supabase error during upsert:', upsertError);
            throw upsertError;
        }

        return new Response(JSON.stringify({ success: true, message: 'Setting updated successfully.', data }), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('--- [ERREUR] Erreur dans update-setting ---');
        console.error('Message:', error.message);
        return new Response(JSON.stringify({ success: false, message: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers
        });
    }
}
