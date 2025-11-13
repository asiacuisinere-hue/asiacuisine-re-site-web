import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        const { quote_id } = await context.request.json();
        if (!quote_id) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing required field: quote_id' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch the quote and its items
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select('*, items') // Assuming items are stored as JSONB in the quotes table
            .eq('id', quote_id)
            .single();

        if (quoteError) throw new Error(`Quote not found: ${quoteError.message}`);
        if (quote.status !== 'accepted') {
            throw new Error(`Quote status is '${quote.status}', not 'accepted'. Cannot create invoice.`);
        }

        // 2. Create the invoice payload
        const invoicePayload = {
            quote_id: quote.id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            items: quote.items,
            total_amount: quote.total_amount,
            status: 'draft', // Initial status for a new invoice
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Due in 30 days
        };

        // 3. Insert the new invoice
        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoicePayload)
            .select()
            .single();

        if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

        // 4. Update the quote status to 'invoiced'
        const { error: updateQuoteError } = await supabase
            .from('quotes')
            .update({ status: 'invoiced' })
            .eq('id', quote.id);

        if (updateQuoteError) {
            // Log the error but don't block the response as the invoice was created
            console.error(`Failed to update quote status for quote_id ${quote.id}:`, updateQuoteError.message);
        }

        return addCorsHeaders(new Response(JSON.stringify({ 
            success: true, 
            invoiceId: newInvoice.id 
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur dans create-invoice-from-quote ---');
        console.error('Message:', error.message);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}
