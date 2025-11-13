import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    // Set CORS headers for all responses
    const headers = {
        'Access-Control-Allow-Origin': 'https://gestion.asiacuisine.re', // Allow only your dashboard origin
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    // Handle OPTIONS preflight request
    if (context.request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        const { data: invoices, error } = await supabase
            .from('invoices')
            .select(`
                *,
                clients (id, last_name, first_name, email, phone),
                entreprises (id, nom_entreprise, contact_email, contact_telephone),
                quotes (id, quote_date, total_amount, status)
            `)
            .order('created_at', { ascending: false }); // Order by creation date, newest first

        if (error) {
            console.error('Supabase error:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch invoices', details: error.message }), {
                status: 500,
                headers
            });
        }

        return new Response(JSON.stringify(invoices), {
            status: 200,
            headers
        });

    } catch (error) {
        console.error('Error in get-invoices function:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers
        });
    }
}
