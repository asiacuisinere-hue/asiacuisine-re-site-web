import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    try {
        const url = new URL(context.request.url);
        const demandId = url.searchParams.get('id');

        if (!demandId) {
            return new Response(JSON.stringify({ error: 'Missing required parameter: id' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Initialiser Supabase
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // Récupérer le statut de la demande
        const { data, error } = await supabase
            .from('demandes')
            .select('status')
            .eq('id', demandId)
            .single();

        if (error) throw error;

        return new Response(JSON.stringify({ status: data.status }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error fetching demand status:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
