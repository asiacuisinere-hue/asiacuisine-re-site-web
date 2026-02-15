import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateQuotePDF } from "../_shared/pdf-quote.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response('ok', { headers: corsHeaders });

    try {
        const { quoteId, signature_image, signer_name, ip } = await req.json();
        if (!quoteId) throw new Error("ID du devis manquant.");

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Mettre à jour les données de signature
        const updateData: any = { 
            status: 'accepted', 
            updated_at: new Date().toISOString() 
        };

        if (signature_image) {
            updateData.signature_image = signature_image;
            updateData.signer_name = signer_name;
            updateData.signature_ip = ip;
            updateData.signed_at = new Date().toISOString();
        }

        const { data: updatedQuote, error: updateError } = await supabase
            .from('quotes')
            .update(updateData)
            .eq('id', quoteId)
            .select('*, clients(*), entreprises(*)')
            .single();

        if (updateError) throw updateError;

        // 2. Récupérer les articles pour la régénération du PDF
        const { data: items } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quoteId);

        // 3. Régénérer le PDF avec la signature
        const customer = updatedQuote.clients || updatedQuote.entreprises;
        const pdfBytes = await generateQuotePDF(updatedQuote, customer, items || [], updatedQuote.total_amount);

        // 4. Écraser l'ancien PDF dans le Storage
        const filePath = updatedQuote.storage_path;
        if (filePath) {
            await supabase.storage.from('documents').upload(filePath, pdfBytes, {
                contentType: 'application/pdf',
                upsert: true,
            });
        }

        // 5. Déclencher automatiquement la création de la facture
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-invoice-from-quote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ quoteId: quoteId })
        });

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
