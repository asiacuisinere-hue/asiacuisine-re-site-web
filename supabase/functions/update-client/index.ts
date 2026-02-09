import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { id, table, ...updates } = await req.json();

    console.log(`[Update Function] Table: ${table}, ID: ${id}`);
    console.log(`[Update Function] Updates:`, JSON.stringify(updates));

    if (!id || !table) {
      throw new Error("Missing ID or table name");
    }

    const { data, error } = await supabaseClient
      .from(table)
      .update(updates)
      .eq("id", id)
      .select();

    if (error) throw error;

    console.log(`[Update Function] Success. Rows updated: ${data.length}`);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error(`[Update Function] Error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
