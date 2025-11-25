import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format } from "https://deno.land/std@0.224.0/datetime/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteId } = await req.json();
    if (!quoteId) {
      throw new Error('Missing quoteId');
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch quote data
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError) throw new Error(`Failed to fetch quote: ${quoteError.message}`);

    // 2. Check if an invoice already exists
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id, document_number')
      .eq('quote_id', quoteId)
      .maybeSingle();
    
    if (existingInvoice) {
      return new Response(
        JSON.stringify({ success: true, invoiceId: existingInvoice.id, documentNumber: existingInvoice.document_number, message: 'Invoice already exists' }), 
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch quote items
    const { data: quoteItems, error: itemsError } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', quoteId);
    if (itemsError) throw new Error(`Failed to fetch quote items: ${itemsError.message}`);

    // 4. Generate the new invoice document number
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
    
    const documentNumber = `FR_${year}_${month}_${week}_${dayOfWeek}_${paddedOrderNumber}_${randomCode}`;

    // 5. Create the new invoice
    const invoicePayload = {
      quote_id: quote.id,
      client_id: quote.client_id,
      entreprise_id: quote.entreprise_id,
      document_number: documentNumber,
      total_amount: quote.total_amount,
      status: 'pending',
      items: quoteItems,
    };

    const { data: newInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoicePayload)
      .select()
      .single();

    if (invoiceError) throw new Error(`Failed to create invoice: ${invoiceError.message}`);

    return new Response(
      JSON.stringify({ success: true, invoiceId: newInvoice.id, documentNumber: newInvoice.document_number }), 
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('Error in create-invoice-from-quote:', error.message);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: error.message }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
