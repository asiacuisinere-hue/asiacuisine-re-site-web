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

        // 1. Fetch the quote with all related data
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

        // 2. Check if an invoice already exists
        const { data: existingInvoice } = await supabase
            .from('invoices')
            .select('id')
            .eq('quote_id', quoteId)
            .maybeSingle();
            
        if (existingInvoice) {
            throw new Error(`An invoice already exists for quote ${quoteId}`);
        }

        // 3. Build invoice payload (base fields)
        const invoicePayload = {
            quote_id: quote.id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            total_amount: quote.total_amount,
            deposit_amount: quote.deposit_amount || 0,
            status: (quote.deposit_amount && quote.deposit_amount > 0) ? 'deposit_paid' : 'pending',
            items: quote.quote_items.map(item => ({
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
            })),
        };

        // 4. Handle demande_id (two workflows support)
        if (quote.demande_id) {
            // Workflow 1: Quote created from a demande
            // Verify the demande still exists
            const { data: demande, error: demandeError } = await supabase
                .from('demandes')
                .select('id, status')
                .eq('id', quote.demande_id)
                .maybeSingle();
            
            if (demandeError) {
                console.error('Error checking demande:', demandeError);
            }
            
            if (demande) {
                // Demande exists, link it to invoice
                invoicePayload.demande_id = quote.demande_id;
                console.log(`Invoice will be linked to demande ${quote.demande_id}`);
            } else {
                // Demande was deleted, proceed without it
                console.warn(`Demande ${quote.demande_id} not found. Creating invoice without demande link.`);
            }
        } else {
            // Workflow 2: Direct quote creation (no demande)
            console.log('Quote has no demande_id. Creating standalone invoice.');
        }

        // 5. Create the invoice
        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoicePayload)
            .select('id, demande_id')
            .single();

        if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

        // 6. Auto-complete linked demande if applicable
        if (newInvoice.demande_id) {
            try {
                const { data: linkedDemande } = await supabase
                    .from('demandes')
                    .select('type')
                    .eq('id', newInvoice.demande_id)
                    .single();

                if (linkedDemande?.type === 'RESERVATION_SERVICE') {
                    await supabase
                        .from('demandes')
                        .update({ status: 'completed' })
                        .eq('id', newInvoice.demande_id);
                    
                    console.log(`Demande ${newInvoice.demande_id} auto-completed`);
                }
            } catch (error) {
                console.error('Failed to auto-complete demande:', error.message);
                // Don't throw - invoice is already created
            }
        }

        return addCorsHeaders(new Response(JSON.stringify({ 
            success: true, 
            invoiceId: newInvoice.id,
            linkedToDemande: !!newInvoice.demande_id,
            workflow: newInvoice.demande_id ? 'with_demande' : 'direct'
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('[ERROR] in create-invoice-from-quote:', error);
        return addCorsHeaders(new Response(JSON.stringify({ 
            error: 'Internal Server Error', 
            details: error.message 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}