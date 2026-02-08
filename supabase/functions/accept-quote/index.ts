import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response('ok', { headers: corsHeaders });

    try {
        const { quoteId } = await req.json();
        if (!quoteId) throw new Error("ID du devis manquant.");

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Mettre à jour le statut du devis
        const { data: quote, error: updateError } = await supabase
            .from('quotes')
            .update({ status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', quoteId)
            .select('*')
            .single();

        if (updateError) throw updateError;

        // 2. Déclencher automatiquement la création de la facture
        // On appelle l'Edge Function existante internement
        const invoiceResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-invoice-from-quote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ quoteId: quoteId })
        });

        if (!invoiceResponse.ok) {
            console.error("Erreur lors de la création auto de la facture après acceptation.");
        }

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
