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
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: `Method ${req.method} Not Allowed` }), {
            status: 405,
            headers: { ...corsHeaders, 'Allow': 'POST' }
        });
    }

    try {
        const { expense_date, description, amount, category, demand_id, business_unit } = await req.json();

        // Validate required fields
        if (!expense_date || !description || !amount || !category) {
            return new Response(JSON.stringify({ error: 'Missing required fields (expense_date, description, amount, category)' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
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
                amount, 
                category, 
                demand_id,
                business_unit: business_unit || 'cuisine' // Par défaut 'cuisine' si non spécifié
            }])
            .select();

        if (error) {
            throw new Error(error.message);
        }

        return new Response(JSON.stringify(data), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error creating expense:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            details: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
