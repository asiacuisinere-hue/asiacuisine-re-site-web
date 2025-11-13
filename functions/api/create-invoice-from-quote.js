import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    // Handle preflight requests
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 }));
    }

    try {
        const { quoteId } = await context.request.json();
        if (!quoteId) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'quoteId is required' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch the quote and its items
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select('*, quote_items(*)')
            .eq('id', quoteId)
            .single();

        if (quoteError) throw new Error(`Failed to fetch quote: ${quoteError.message}`);
        if (!quote) throw new Error('Quote not found.');
        if (quote.status === 'accepted' || quote.status === 'invoiced') {
            throw new Error('This quote has already been processed.');
        }

        // 2. Create the new invoice
        const invoicePayload = {
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            quote_id: quote.id,
            total_amount: quote.total_amount,
            status: 'draft', // Initial status
        };

        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoicePayload)
            .select()
            .single();

        if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

        // 3. Copy quote items to invoice items
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

        // 4. Update the original quote's status to 'Accepted'
        const { error: updateQuoteError } = await supabase
            .from('quotes')
            .update({ status: 'Accepté' })
            .eq('id', quoteId);

        if (updateQuoteError) throw new Error(`Failed to update quote status: ${updateQuoteError.message}`);

        return addCorsHeaders(new Response(JSON.stringify({
            success: true,
            invoiceId: newInvoice.id,
            message: `Invoice ${newInvoice.id.substring(0, 8)} created successfully from quote ${quoteId.substring(0, 8)}.`,
        }), { status: 201 }));

    } catch (error) {
        console.error('Error creating invoice from quote:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}