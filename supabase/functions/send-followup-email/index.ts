import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from 'https://esm.sh/resend@3.4.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { demandeId } = await req.json();
    if (!demandeId) throw new Error('demandeId est manquant.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Récupérer la demande et les réglages entreprise
    const { data: demande, error: demErr } = await supabase
      .from('demandes')
      .select('*, clients(*), entreprises(*)')
      .eq('id', demandeId)
      .single();

    if (demErr || !demande) throw new Error("Demande introuvable.");

    const { data: companySettings } = await supabase.from('company_settings').select('*').limit(1).single();

    const client = demande.clients || demande.entreprises;
    if (!client) throw new Error("Client introuvable.");

    const recipientEmail = client.email || client.contact_email;
    const recipientName = client.first_name || client.contact_name || client.nom_entreprise || 'Client';
    const requestDateStr = new Date(demande.request_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

    // 2. Envoyer l'email via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    
    await resend.emails.send({
      from: 'Asiacuisine.re <contact@asiacuisine.re>',
      to: [recipientEmail],
      reply_to: 'contact@asiacuisine.re',
      subject: "Merci d'avoir choisi Asiacuisine.re !",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://www.asiacuisine.re/favicon.png" style="width: 80px;">
          </div>
          <h2 style="color: #d4af37; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Merci pour votre confiance !</h2>
          <p>Bonjour <strong>${recipientName}</strong>,</p>
          <p>Nous tenions à vous remercier d'avoir fait appel à nos services pour votre événement du <strong>${requestDateStr}</strong>.</p>
          <p>Nous espérons que l'expérience culinaire a été à la hauteur de vos attentes.</p>
          
          <div style="margin: 25px 0; padding: 20px; background-color: #fffaf0; border: 1px solid #fdf2d2; border-radius: 12px; text-align: center;">
            <p style="margin-bottom: 15px; color: #b45309; font-weight: bold;">Votre avis est précieux</p>
            <p style="margin-bottom: 20px; color: #666; font-size: 14px;">Si vous avez un moment, nous serions ravis que vous partagiez votre expérience sur nos réseaux sociaux ou en répondant à cet e-mail.</p>
            <div style="display: flex; justify-content: center; gap: 15px;">
                <a href="https://www.facebook.com/asiacuisine.re" style="color: #d4af37; font-weight: bold; text-decoration: none;">Facebook</a>
                <a href="https://www.instagram.com/asiacuisine.re" style="color: #d4af37; font-weight: bold; text-decoration: none;">Instagram</a>
            </div>
          </div>

          <p>Au plaisir de vous régaler à nouveau,</p>
          <p>Cordialement,<br><strong>L'équipe Asiacuisine.re</strong></p>
          
          <p style="margin-top: 30px; font-size: 12px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
            <strong>Asiacuisine.re</strong><br>
            Chef privé, cours de cuisine et plats à emporter à La Réunion
          </p>
        </div>
      `,
    });

    // 3. Clôturer le dossier
    await supabase.from('demandes').update({ status: 'completed' }).eq('id', demandeId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
