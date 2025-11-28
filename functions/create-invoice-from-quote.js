import { createClient } from '@supabase/supabase-js';
import { format } from "https://deno.land/std@0.224.0/datetime/mod.ts"; // Import format for date utility

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
};

// --- Helper Functions (Copied from generate-quote) ---
function getWeekNumber(d) { // d: Date
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

function randomString(length) { // length: number
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

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

        // --- Generate Invoice Document Number (FR_...) ---
        const now = new Date();
        const year = format(now, "yyyy");
        const month = format(now, "MM");
        const week = getWeekNumber(now);
        const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const { count, error: countError } = await supabase
            .from("invoices")
            .select("*", { count: "exact", head: true })
            .gte("created_at", todayStart.toISOString());

        if (countError) throw new Error(`Erreur comptage factures: ${countError.message}`);

        const orderNumber = (count || 0) + 1;
        const paddedOrderNumber = String(orderNumber).padStart(4, "0");
        const randomCode = randomString(6);
        
        const invoiceDocumentNumber = `FR_${year}_${month}_${week}_${dayOfWeek}_${paddedOrderNumber}_${randomCode}`;

        // 3. Build invoice payload
        const invoicePayload = {
            quote_id: quote.id,
            client_id: quote.client_id,
            entreprise_id: quote.entreprise_id,
            demand_id: quote.demand_id || null, // Ensure demand_id is always present
            document_number: invoiceDocumentNumber, // Add the generated document number here
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

        // 4. Create the invoice
        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoicePayload)
            .select('id, demand_id')
            .single();

        if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

        // 5. Auto-complete linked demande if applicable
        if (newInvoice.demand_id) {
            try {
                const { data: linkedDemande } = await supabase
                    .from('demandes')
                    .select('type')
                    .eq('id', newInvoice.demand_id)
                    .single();

                if (linkedDemande?.type === 'RESERVATION_SERVICE') {
                    await supabase
                        .from('demandes')
                        .update({ status: 'completed' })
                        .eq('id', newInvoice.demand_id);
                    
                    console.log(`Demande ${newInvoice.demand_id} auto-completed`);
                }
            } catch (error) {
                console.error('Failed to auto-complete demande:', error.message);
                // Don't throw - invoice is already created
            }
        }

        return addCorsHeaders(new Response(JSON.stringify({ 
            success: true, 
            invoiceId: newInvoice.id,
            linkedToDemande: !!newInvoice.demand_id,
            workflow: newInvoice.demand_id ? 'with_demande' : 'direct'
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