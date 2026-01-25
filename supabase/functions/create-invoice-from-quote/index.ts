import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Helper Functions ---
function getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

function randomString(length: number): string {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

serve(async (req) => {
    console.log("--- [create-invoice-from-quote] Executing version 2: No auto-complete to 'completed' ---");
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

        // --- Generate Invoice Document Number (FR_...) ---
        const now = new Date();
        const year = format(now, "yyyy");
        const month = format(now, "MM");
        const week = getWeekNumber(now);
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const { count, error: countError } = await supabaseAdmin
            .from("invoices")
            .select("*", { count: "exact", head: true })
            .gte("created_at", todayStart.toISOString());

        if (countError) throw new Error(`Erreur comptage factures: ${countError.message}`);

        const orderNumber = (count || 0) + 1;
        const paddedOrderNumber = String(orderNumber).padStart(4, "0");
        const randomCode = randomString(6);
        
        const invoiceDocumentNumber = `FR_${year}_${month}_${week}_${dayOfWeek}_${paddedOrderNumber}_${randomCode}`;

        const invoicePayload: any = {
            quote_id: quote.id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            document_number: invoiceDocumentNumber,
            demand_id: null, // Start with null
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

        return new Response(
            JSON.stringify({ success: true, invoiceId: newInvoice.id, workflow: newInvoice.demand_id ? 'with_demande' : 'direct' }),
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
