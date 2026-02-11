import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { demandeId } = await req.json();

    // 1. Fetch Demande & Client Details
    const { data: demande, error: fetchError } = await supabase
      .from('demandes')
      .select('*, clients(*), entreprises(*)')
      .eq('id', demandeId)
      .single();

    if (fetchError || !demande) throw new Error("Demande introuvable");

    const client = demande.clients || demande.entreprises;
    const clientEmail = demande.clients ? client.email : client.contact_email;
    const clientName = demande.clients ? client.first_name : (client.contact_name || client.nom_entreprise);
    const requestIdShort = demandeId.substring(0, 8);
    const trackingUrl = `https://www.asiacuisine.re/suivi.html?id=${requestIdShort}`;

    // 2. Send Email via Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    await resend.emails.send({
      from: "Asiacuisine.re <no-reply@asiacuisine.re>",
      to: clientEmail,
      subject: "Confirmation de votre demande - Asiacuisine.re",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
          <h2 style="color: #d4af37; text-align: center;">Bonjour ${clientName} !</h2>
          <p>Bonne nouvelle ! Le Chef a bien reçu votre demande et elle est maintenant validée.</p>  

          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Référence de demande :</strong> #${requestIdShort}</p>        
            <p style="margin: 5px 0 0 0;"><strong>Type :</strong> ${demande.type.replace('_', ' ')}</p>   
          </div>

          <p>Vous pouvez suivre l'évolution de votre dossier, accéder à vos documents (devis, facture) et effectuer votre règlement à tout moment en cliquant sur le bouton ci-dessous :</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${trackingUrl}" style="background-color: #d4af37; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Accéder à mon espace de suivi</a>
          </div>

          <p>Si vous avez des questions, n'hésitez pas à nous contacter directement sur WhatsApp.</p>   
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">Asiacuisine.re - Votre Chef Privé à La Réunion</p>
        </div>
      `,
    });

    // 3. Update Status to move from Inbox to 'En cours'
    // For Menus -> Wait for payment
    // For Services -> Confirmed (ready for quote)
    let newStatus = 'En attente de paiement';
    if (demande.type === 'RESERVATION_SERVICE') {
        newStatus = 'confirmed';
    }

    const { error: updateError } = await supabase
        .from('demandes')
        .update({ status: newStatus })
        .eq('id', demandeId);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
