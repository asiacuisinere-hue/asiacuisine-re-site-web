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
    if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: `Method ${req.method} Not Allowed` }), {
            status: 405,
            headers: { ...corsHeaders, 'Allow': 'GET' }
        });
    }

    try {
        const url = new URL(req.url);
        const category = url.searchParams.get('category');
        const start_date = url.searchParams.get('start_date');
        const end_date = url.searchParams.get('end_date');

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        let query = supabase
            .from('expenses')
            .select('*'); // Select all columns

        if (category) {
            query = query.eq('category', category);
        }
        if (start_date) {
            query = query.gte('expense_date', start_date);
        }
        if (end_date) {
            query = query.lte('expense_date', end_date);
        }
        
        query = query.order('expense_date', { ascending: false });

        const { data, error } = await query;

        if (error) {
            throw new Error(error.message);
        }

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error getting expenses:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            details: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});