import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateQuotePDF } from "../_shared/pdf-quote.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsAppAlert(message: string) {
  const phone = Deno.env.get("ADMIN_WHATSAPP_NUMBER");
  const apiKey = Deno.env.get("ADMIN_WHATSAPP_API_KEY");
  if (!phone || !apiKey) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    await fetch(url);
  } catch (err) { console.error("[WhatsApp Error]", err); }
}

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
            .select('id, demand_id, storage_path, total_amount, clients(*), entreprises(*)')
            .single();

        if (updateError) throw updateError;
        
        await sendWhatsAppAlert(`✅ Devis accepté par ${signer_name || 'le client'}.`);

        // 2. Mettre à jour le statut de la demande associée
        if (updatedQuote.demand_id) {
            const { error: demandUpdateError } = await supabase
                .from('demandes')
                .update({ status: 'confirmed' })
                .eq('id', updatedQuote.demand_id);

            if (demandUpdateError) {
                console.error("Erreur lors de la mise à jour du statut de la demande:", demandUpdateError.message);
                await sendWhatsAppAlert(`⚠️ Erreur! Le devis a été accepté mais le statut de la demande n'a pas pu être mis à jour: ${demandUpdateError.message}`);
            } else {
                await sendWhatsAppAlert(`👍 Statut de la demande ${updatedQuote.demand_id.substring(0,8)} mis à jour en 'confirmed'.`);
            }
        } else {
            await sendWhatsAppAlert(`🤔 Info: Devis accepté mais aucune demande associée à mettre à jour.`);
        }

        // 3. Récupérer les articles pour la régénération du PDF
        const { data: items } = await supabase
            .from('quote_items')
            .select('*')
            .eq('quote_id', quoteId);

        // 4. Régénérer le PDF avec la signature visuelle
        const customer = updatedQuote.clients || updatedQuote.entreprises;
        const pdfBytes = await generateQuotePDF(updatedQuote, customer, items || [], updatedQuote.total_amount);

        // 5. Écraser l'ancien PDF dans le Storage
        if (updatedQuote.storage_path) {
            await supabase.storage.from('documents').upload(updatedQuote.storage_path, pdfBytes, {
                contentType: 'application/pdf',
                upsert: true,
            });
        }

        // 6. Créer la Facture d'Acompte
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
