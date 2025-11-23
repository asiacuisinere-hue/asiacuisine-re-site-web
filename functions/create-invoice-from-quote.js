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
        const { quoteId } = await context.request.json();
        if (!quoteId) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing quoteId' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch the quote and its items
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select(`
                *,
                quote_items (*)
            `)
            .eq('id', quoteId)
            .single();

        if (quoteError) throw new Error(`Failed to fetch quote: ${quoteError.message}`);
        if (!quote) throw new Error('Quote not found');

        // 2. Check if an invoice already exists for this quote
        const { data: existingInvoice, error: existingInvoiceError } = await supabase
            .from('invoices')
            .select('id')
            .eq('quote_id', quoteId)
            .single();
        
        if (existingInvoice) {
            throw new Error(`An invoice already exists for quote ${quoteId}`);
        }

        // 3. Create the new invoice
        const invoicePayload = {
            quote_id: quote.id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            total_amount: quote.total_amount,
            status: 'pending', // Initial status for a new invoice
        };

        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoicePayload)
            .select()
            .single();

        if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

        // 4. Copy quote items to invoice items
        const invoiceItemsPayload = quote.quote_items.map(item => ({
            invoice_id: newInvoice.id,
            service_id: item.service_id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
        }));

        const { error: invoiceItemsError } = await supabase
            .from('invoice_items')
            .insert(invoiceItemsPayload);

        if (invoiceItemsError) throw new Error(`Failed to create invoice items: ${invoiceItemsError.message}`);

        return addCorsHeaders(new Response(JSON.stringify({ success: true, invoiceId: newInvoice.id }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans create-invoice-from-quote ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}
