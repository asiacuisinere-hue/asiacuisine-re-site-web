import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { generateQuotePDF } from '../_shared/pdf-quote.ts'

// --- Helper Functions for Naming ---
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { customer, items, total, type, demandeId, requires_signature } = await req.json();

    if (!customer || !customer.id || !items || items.length === 0 || total === undefined || !type) {
      throw new Error('Champs requis manquants: client, articles, total, ou type.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const week = getWeekNumber(now);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count, error: countError } = await supabaseAdmin
        .from("quotes")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString());

    if (countError) throw new Error(`Erreur comptage devis: ${countError.message}`);

    const orderNumber = (count || 0) + 1;
    const paddedOrderNumber = String(orderNumber).padStart(4, "0");
    const randomCode = randomString(6);
    
    const quoteDocumentNumber = `DR_${year}_${month}_${week}_${dayOfWeek}_${paddedOrderNumber}_${randomCode}`;

    // === INSERTION AVEC LE CHAMP REQUIRES_SIGNATURE ===
    const { data: quoteData, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .insert({
        demand_id: demandeId || null,
        client_id: customer.type === 'client' ? customer.id : null,
        entreprise_id: customer.type === 'entreprise' ? customer.id : null,
        document_number: quoteDocumentNumber,
        total_amount: total,
        status: 'draft',
        type: type,
        requires_signature: requires_signature || false // <-- CORRECTION ICI
      })
      .select()
      .single();

    if (quoteError) throw new Error(`Erreur DB (Quote): ${quoteError.message}`);

    const quoteItems = items.map(item => ({
      quote_id: quoteData.id,
      service_id: item.service_id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.price,
    }));
    
    const { error: itemsError } = await supabaseAdmin.from('quote_items').insert(quoteItems);
    if (itemsError) throw new Error(`Erreur DB (Items): ${itemsError.message}`);

    const pdfBytes = await generateQuotePDF(quoteData, customer, items, total);

    const filePath = `devis/${quoteDocumentNumber}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) throw new Error(`Erreur Storage: ${uploadError.message}`);

    const { error: updateError } = await supabaseAdmin
      .from('quotes')
      .update({ storage_path: filePath })
      .eq('id', quoteData.id);
    if (updateError) throw new Error(`Erreur DB (Update Path): ${updateError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Brouillon de devis créé avec succès.',
        quoteId: quoteData.id
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-quote:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
