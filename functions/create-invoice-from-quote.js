import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405 }));
    }

    try {
        const { quoteId } = await context.request.json();
        if (!quoteId) throw new Error('Missing quoteId');

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch the quote, its items, AND the original demande_id
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select(`
                *,
                demande_id,
                quote_items (*)
            `)
            .eq('id', quoteId)
            .single();

        if (quoteError) throw new Error(`Failed to fetch quote: ${quoteError.message}`);
        if (!quote) throw new Error('Quote not found');

        // Check if an invoice already exists
        const { data: existingInvoice } = await supabase.from('invoices').select('id').eq('quote_id', quoteId).maybeSingle();
        if (existingInvoice) throw new Error(`An invoice already exists for quote ${quoteId}`);

        // 3. Create the new invoice
        const invoicePayload = {
            quote_id: quote.id,
            demande_id: quote.demande_id, // <-- CHAMP CORRIGÉ
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            total_amount: quote.total_amount,
            deposit_amount: quote.deposit_amount, // Transférer l'acompte du devis
            status: quote.deposit_amount > 0 ? 'deposit_paid' : 'pending',
            items: quote.quote_items.map(item => ({
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
            })),
        };

        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoicePayload)
            .select('id')
            .single();

        if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

        return addCorsHeaders(new Response(JSON.stringify({ success: true, invoiceId: newInvoice.id }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('[ERROR] in create-invoice-from-quote:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}
