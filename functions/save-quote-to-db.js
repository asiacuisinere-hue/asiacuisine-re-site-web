import { createClient } from '@supabase/supabase-js';

// --- CORS Headers Helper ---
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
}

// --- Handle OPTIONS (CORS Preflight) ---
export async function onRequestOptions(context) {
    return new Response(null, { status: 204, headers: corsHeaders() });
}

// --- Handle POST Requests ---
export async function onRequestPost(context) {
    try {
        // --- Authentication ---
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${context.env.ADMIN_PASSWORD}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
        }
        
        // --- Parse Request Body ---
        const { customer, items, total, type } = await context.request.json();

        // --- Validate ---
        if (!customer || !customer.id || !items || items.length === 0 || total === undefined || !type) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders() });
        }

        // --- Initialize Supabase ---
        const supabase = createClient(
            context.env.SUPABASE_URL, 
            context.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // --- 1. Insert Quote ---
        const { data: quoteData, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                client_id: customer.id,
                total_amount: total,
                status: 'draft',
                type: type,
            })
            .select()
            .single();

        if (quoteError) {
            console.error('--- [ERROR] save-quote-to-db: Failed to insert quote:', quoteError);
            throw quoteError;
        }
        
        // --- 2. Insert Quote Items ---
        const quoteItems = items.map(item => ({
            quote_id: quoteData.id,
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.price,
        }));

        const { error: itemsError } = await supabase
            .from('quote_items')
            .insert(quoteItems);
            
        if (itemsError) {
            console.error('--- [ERROR] save-quote-to-db: Failed to insert items:', itemsError);
            throw itemsError;
        }
        
        // --- Return Success ---
        return new Response(JSON.stringify({
            success: true,
            quote_id: quoteData.id,
            created_at: quoteData.created_at
        }), { status: 200, headers: corsHeaders() });

    } catch (error) {
        console.error('--- [ERROR] save-quote-to-db: Caught exception:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal Server Error', 
            details: error.message 
        }), { status: 500, headers: corsHeaders() });
    }
}
