import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const resend = new Resend(Deno.env.get("RESEND_API_KEY")!);

    // 1. Récupérer toutes les commandes prêtes
    const { data: demandes, error: fetchError } = await supabase
      .from('demandes')
      .select('*, clients(first_name, email)')
      .eq('status', 'Prêt pour livraison');

    if (fetchError) throw fetchError;
    if (!demandes || demandes.length === 0) {
      return new Response(JSON.stringify({ message: "Aucune commande prête pour livraison." }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const results = [];

    for (const demande of demandes) {
      const clientName = demande.clients?.first_name || "Client";
      const clientEmail = demande.clients?.email;
      const trackingUrl = `https://www.asiacuisine.re/suivi.html?id=${demande.id.substring(0, 8)}`;

      // A. Mise à jour du statut
      await supabase.from('demandes').update({ status: 'En cours de livraison' }).eq('id', demande.id);

      // B. Envoi de l'Email (si email présent)
      if (clientEmail) {
        await resend.emails.send({
          from: 'Asiacuisine.re <livraison@asiacuisine.re>',
          to: clientEmail,
          subject: `🚗 Le Chef est en route ! Suivez votre livraison`,
          html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 20px;">
              <h2 style="color: #d97706; text-align: center;">Bonne nouvelle ${clientName} !</h2>
              <p style="font-size: 16px; color: #333; line-height: 1.5;">
                Le Chef vient de démarrer sa tournée de livraison. Votre commande est à bord !
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${trackingUrl}" style="background-color: #d97706; color: white; padding: 15px 25px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">
                  📍 SUIVRE LE CHEF EN DIRECT
                </a>
              </div>
              <p style="font-size: 12px; color: #888; text-align: center;">
                À très vite pour la dégustation.
              </p>
            </div>
          `
        });
      }

      // C. Notification Push Individualisée
      if (demande.push_subscription_id) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({
              title: "🚚 Le Chef est en route !",
              body: `${clientName}, suivez votre livraison en direct sur la carte.`,
              url: trackingUrl,
              targetSubscriptionId: demande.push_subscription_id
            })
          });
        } catch (e) { console.error(`Push failed for demand ${demande.id}`, e); }
      }

      results.push({ id: demande.id, status: 'notified' });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
