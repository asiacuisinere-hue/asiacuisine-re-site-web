import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { expense_date, description, amount, category, demand_id, business_unit, is_recurring, end_date } = body;

        console.log("📥 Dépense reçue:", JSON.stringify(body));

        // Nettoyage strict des données
        const cleanAmount = parseFloat(amount);
        const cleanEndDate = (is_recurring && end_date && end_date !== "") ? end_date : null;
        const cleanDemandId = (demand_id && demand_id !== "") ? demand_id : null;

        if (!expense_date || !description || isNaN(cleanAmount) || !category) {
            throw new Error('Données obligatoires manquantes ou invalides.');
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        const { data, error } = await supabase
            .from('expenses')
            .insert([{ 
                expense_date, 
                description, 
                amount: cleanAmount, 
                category, 
                demand_id: cleanDemandId,
                business_unit: business_unit || 'cuisine',
                is_recurring: is_recurring || false,
                end_date: cleanEndDate
            }])
            .select();

        if (error) throw error;

        return new Response(JSON.stringify(data), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('❌ Erreur Critique create-expense:', error.message);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
