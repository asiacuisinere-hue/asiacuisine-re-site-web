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

        // 1. Enregistrer la signature et passer le devis en "accepted"
        const { data: updatedQuote, error: updateError } = await supabase
            .from('quotes')
            .update({ 
                status: 'accepted', 
                signature_image, 
                signer_name, 
                signature_ip: ip, 
                signed_at: new Date().toISOString(),
                updated_at: new Date().toISOString() 
            })
            .eq('id', quoteId)
            .select('*, clients(*), entreprises(*)')
            .single();

        if (updateError) throw updateError;

        // 2. Récupérer les articles pour la régénération du PDF
        const { data: items } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quoteId);

        // 3. Régénérer le PDF avec la signature visuelle
        const customer = updatedQuote.clients || updatedQuote.entreprises;
        const pdfBytes = await generateQuotePDF(updatedQuote, customer, items || [], updatedQuote.total_amount);

        // 4. Écraser l'ancien PDF dans le Storage (pour que le client voie sa signature s'il ré-ouvre le lien)
        const filePath = updatedQuote.storage_path;
        if (filePath) {
            await supabase.storage.from('documents').upload(filePath, pdfBytes, {
                contentType: 'application/pdf',
                upsert: true,
            });
        }

        // 5. Créer la Facture d'Acompte (Silencieusement)
        // Cela génère la facture dans votre liste "À envoyer" du Dashboard
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-invoice-from-quote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ quoteId: quoteId })
        });

        // --- AUCUN ENVOI D'EMAIL ICI ---
        // Vous gardez le contrôle manuel depuis le Dashboard.

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
