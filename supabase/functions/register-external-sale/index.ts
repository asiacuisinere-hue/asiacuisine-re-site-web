import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    // 1. Handle CORS for external requests
    if (req.method === "OPTIONS") {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        const { amount, description, client_name, token } = await req.json();

        // 2. Security Check: Validate incoming token
        const expectedToken = Deno.env.get("EXTERNAL_SALE_TOKEN");
        if (!token || token !== expectedToken) {
            console.error("Unauthorized sale registration attempt.");
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 3. Validate Data
        if (!amount || !description) {
            return new Response(JSON.stringify({ error: "Missing required fields (amount, description)" }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 4. Create an entry in 'invoices' table
        // We mark it as 'paid' directly since it comes from an external validated sale
        const { data, error } = await supabase
            .from('invoices')
            .insert([{ 
                total_amount: parseFloat(amount), 
                description: description,
                // On pourrait ajouter d'autres champs si besoin
                status: 'paid',
                business_unit: 'courtage', // Toujours courtage pour Luxilo
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;

        console.log(`[register-external-sale] Successfully registered sale of ${amount}€ for: ${description}`);

        return new Response(JSON.stringify({ success: true, data }), {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('[register-external-sale] FATAL ERROR:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            details: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
