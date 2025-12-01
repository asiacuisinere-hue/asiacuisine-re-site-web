import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    // Only allow GET requests
    if (context.request.method !== 'GET') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
            status: 405,
            headers: { 'Allow': 'GET' }
        });
    }

    try {
        const supabaseUrl = context.env.SUPABASE_URL;
        const supabaseKey = context.env.SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            console.error('[/get-announcement] Supabase credentials missing.');
            return new Response(JSON.stringify({ error: 'Configuration Supabase manquante.' }), { status: 500 });
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', ['announcement_message', 'announcement_style', 'announcement_enabled']);

        if (error) {
            console.error('[/get-announcement] Error fetching announcement:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        const settingsMap = data.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {});

        const payload = {
            announcement_message: settingsMap.announcement_message || '',
            announcement_style: settingsMap.announcement_style || 'info',
            announcement_enabled: settingsMap.announcement_enabled || 'false'
        };

        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[/get-announcement] Error in /get-announcement:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
    }
}
