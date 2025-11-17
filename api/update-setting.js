
import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Allow': 'POST' } });
    }

    try {
        const { password, key, value } = await context.request.json();

        // 1. Authenticate
        if (password !== context.env.ADMIN_PASSWORD) {
            return new Response(JSON.stringify({ success: false, message: 'Invalid password.' }), { status: 401 });
        }

        // 2. Validate input
        if (!key || value === undefined || value === null) {
            return new Response(JSON.stringify({ success: false, message: 'Setting key and value are required.' }), { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 3. Upsert the setting
        const { data, error } = await supabase
            .from('settings')
            .upsert({ key: key, value: value }, { onConflict: 'key' });

        if (error) {
            console.error('Supabase error during upsert:', error);
            throw error;
        }

        return new Response(JSON.stringify({ success: true, message: 'Setting updated successfully.', data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('--- [ERREUR] Erreur dans update-setting ---');
        console.error('Message:', error.message);
        return new Response(JSON.stringify({ success: false, message: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
