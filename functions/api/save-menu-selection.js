import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
    }

    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
    }

    try {
        const { demandId, selectedDishes, serviceStyle } = await context.request.json();

        if (!demandId || !selectedDishes || !serviceStyle) {
            return new Response(JSON.stringify({ error: 'Missing required data' }), { status: 400, headers });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Trouver la demande par son ID court
        const { data: demande, error: findError } = await supabase
            .from('demandes')
            .select('id, details_json')
            .ilike('id', `${demandId}%`)
            .single();

        if (findError || !demande) {
            return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404, headers });
        }

        // 2. Mettre à jour les détails
        const updatedDetails = {
            ...demande.details_json,
            client_selection: {
                dishes: selectedDishes,
                serviceStyle: serviceStyle,
                completed_at: new Date().toISOString()
            }
        };

        const { error: updateError } = await supabase
            .from('demandes')
            .update({ details_json: updatedDetails })
            .eq('id', demande.id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, message: 'Selection saved successfully' }), { status: 200, headers });

    } catch (error) {
        console.error('Error saving menu selection:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers });
    }
}
