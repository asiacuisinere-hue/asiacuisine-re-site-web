import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) throw new Error('Missing authorization header');

        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { quoteId } = await req.json();
        if (!quoteId) throw new Error('Missing quoteId');

        const { data: quote, error: quoteError } = await supabaseAdmin
            .from('quotes')
            .select(`*, quote_items (*), demand_id`)
            .eq('id', quoteId)
            .single();

        if (quoteError) throw new Error(`Failed to fetch quote: ${quoteError.message}`);
        if (!quote) throw new Error('Quote not found');

        const { data: existingInvoice } = await supabaseAdmin.from('invoices').select('id').eq('quote_id', quoteId).maybeSingle();
        if (existingInvoice) throw new Error(`An invoice already exists for quote ${quoteId}`);

        const invoicePayload = {
            quote_id: quote.id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            total_amount: quote.total_amount,
            deposit_amount: quote.deposit_amount || 0,
            status: (quote.deposit_amount && quote.deposit_amount > 0) ? 'deposit_paid' : 'pending',
            items: quote.quote_items.map((item) => ({
                name: item.name, description: item.description, quantity: item.quantity, unit_price: item.unit_price,
            })),
        };

        if (quote.demand_id) {
            const { data: demande } = await supabaseAdmin.from('demandes').select('id').eq('id', quote.demand_id).maybeSingle();
            if (demande) {
                invoicePayload.demand_id = quote.demand_id;
            } else {
                console.warn(`Demand ${quote.demand_id} not found. Creating invoice without demand link.`);
            }
        }

        const { data: newInvoice, error: invoiceError } = await supabaseAdmin.from('invoices').insert(invoicePayload).select('id, demand_id').single();
        if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

        if (newInvoice.demand_id) {
            const { data: linkedDemande } = await supabaseAdmin.from('demandes').select('type').eq('id', newInvoice.demand_id).single();
            if (linkedDemande?.type === 'RESERVATION_SERVICE') {
                await supabaseAdmin.from('demandes').update({ status: 'completed' }).eq('id', newInvoice.demand_id);
            }
        }

        return new Response(
            JSON.stringify({ success: true, invoiceId: newInvoice.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
        );

    } catch (error) {
        console.error('--- [FATAL ERROR] in create-invoice-from-quote:', error);
        return new Response(
            JSON.stringify({ error: 'Internal Server Error', details: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
    }
});
