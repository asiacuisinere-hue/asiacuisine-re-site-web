import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        const { data: dishes, error } = await supabase
            .from('dishes')
            .select('*')
            .eq('is_available', true)
            .order('name');

        if (error) throw error;

        return new Response(JSON.stringify(dishes), { status: 200, headers });

    } catch (error) {
        console.error('Error fetching dishes:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch dishes' }), { status: 500, headers });
    }
}
