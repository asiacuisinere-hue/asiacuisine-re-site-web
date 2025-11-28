import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Get authorization header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            throw new Error('Missing authorization header');
        }

        // Create Supabase client with user's auth
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        );

        // Create admin client for operations that need service role
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Parse request body
        const { quoteId } = await req.json();
        if (!quoteId) {
            throw new Error('Missing quoteId');
        }

        console.log('--- [DEBUG] Creating invoice from quote:', quoteId);

        // 1. Fetch the quote with all related data
        const { data: quote, error: quoteError } = await supabaseAdmin
            .from('quotes')
            .select(`
                *,
                quote_items (*)
            `)
            .eq('id', quoteId)
            .single();

        if (quoteError) {
            console.error('Error fetching quote:', quoteError);
            throw new Error(`Failed to fetch quote: ${quoteError.message}`);
        }
        
        if (!quote) {
            throw new Error('Quote not found');
        }

        console.log('--- [DEBUG] Quote found:', { 
            id: quote.id, 
            demand_id: quote.demand_id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id
        });

        // 2. Check if an invoice already exists
        const { data: existingInvoice } = await supabaseAdmin
            .from('invoices')
            .select('id')
            .eq('quote_id', quoteId)
            .maybeSingle();

        if (existingInvoice) {
            throw new Error(`An invoice already exists for quote ${quoteId}`);
        }

        // 3. Build invoice payload (base fields)
        const invoicePayload: any = {
            quote_id: quote.id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            total_amount: quote.total_amount,
            deposit_amount: quote.deposit_amount || 0,
            status: (quote.deposit_amount && quote.deposit_amount > 0) ? 'deposit_paid' : 'pending',
            items: quote.quote_items.map((item: any) => ({
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
            })),
        };

        // 4. Handle demand_id (two workflows support)
        if (quote.demand_id) {
            console.log('--- [DEBUG] Quote has demand_id, verifying it exists...');
            
            // Workflow 1: Quote created from a demande
            // Verify the demande still exists
            const { data: demande, error: demandeError } = await supabaseAdmin
                .from('demandes')
                .select('id, status, type')
                .eq('id', quote.demand_id)
                .maybeSingle();

            if (demandeError) {
                console.error('Error checking demande:', demandeError);
            }

            if (demande) {
                // Demande exists, link it to invoice
                invoicePayload.demand_id = quote.demand_id;
                console.log('--- [DEBUG] Demande exists, linking to invoice:', demande.id);
            } else {
                // Demande was deleted, proceed without it
                console.warn(`--- [WARN] Demande ${quote.demand_id} not found. Creating invoice without demande link.`);
            }
        } else {
            // Workflow 2: Direct quote creation (no demande)
            console.log('--- [DEBUG] Quote has no demand_id. Creating standalone invoice.');
        }

        console.log('--- [DEBUG] Invoice payload:', JSON.stringify(invoicePayload, null, 2));

        // 5. Create the invoice
        const { data: newInvoice, error: invoiceError } = await supabaseAdmin
            .from('invoices')
            .insert(invoicePayload)
            .select('id, demand_id')
            .single();

        if (invoiceError) {
            console.error('--- [ERROR] Failed to create invoice:', invoiceError);
            throw new Error(`Failed to create invoice: ${invoiceError.message}`);
        }

        console.log('--- [DEBUG] Invoice created successfully:', newInvoice.id);

        // 6. Auto-complete linked demande if applicable
        if (newInvoice.demand_id) {
            try {
                const { data: linkedDemande } = await supabaseAdmin
                    .from('demandes')
                    .select('type')
                    .eq('id', newInvoice.demand_id)
                    .single();

                if (linkedDemande?.type === 'RESERVATION_SERVICE') {
                    await supabaseAdmin
                        .from('demandes')
                        .update({ status: 'completed' })
                        .eq('id', newInvoice.demand_id);

                    console.log(`--- [DEBUG] Demande ${newInvoice.demand_id} auto-completed`);
                }
            } catch (error) {
                console.error('Failed to auto-complete demande:', error);
                // Don't throw - invoice is already created
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                invoiceId: newInvoice.id,
                linkedToDemande: !!newInvoice.demand_id,
                workflow: newInvoice.demand_id ? 'with_demande' : 'direct'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 201,
            }
        );

    } catch (error) {
        console.error('--- [ERROR] in create-invoice-from-quote:', error);
        return new Response(
            JSON.stringify({
                error: 'Internal Server Error',
                details: error.message
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500,
            }
        );
    }
});