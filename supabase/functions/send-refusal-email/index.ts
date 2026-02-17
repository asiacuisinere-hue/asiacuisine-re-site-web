import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from 'https://esm.sh/resend@3.4.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Gestion du CORS (Preflight request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { demandeId } = await req.json();
    if (!demandeId) throw new Error('demandeId est manquant.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Récupérer la demande et le template
    const [demRes, setRes] = await Promise.all([
      supabase.from('demandes').select('*, clients(*), entreprises(*)').eq('id', demandeId).single(),
      supabase.from('settings').select('value').eq('key', 'refusalEmailTemplate').maybeSingle()
    ]);

    if (demRes.error || !demRes.data) throw new Error("Demande introuvable.");
    const demande = demRes.data;

    const client = demande.clients || demande.entreprises;
    if (!client) throw new Error("Client introuvable.");

    const recipientEmail = client.email || client.contact_email;
    const recipientName = client.first_name || client.contact_name || client.nom_entreprise || 'Client';

    // 2. Préparer le message
    const defaultMsg = `Nous avons bien reçu votre demande de service sur Asiacuisine.re.

Après examen attentif, nous sommes au regret de vous informer que nous ne pourrons pas donner suite à votre demande pour le moment.

Nous vous remercions de votre intérêt.`;
    let messageBody = setRes.data?.value || defaultMsg;
    messageBody = messageBody.replace('${clientName}', recipientName);

    // 3. Envoyer via Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const { error: mailError } = await resend.emails.send({
      from: 'Asiacuisine.re <contact@asiacuisine.re>',
      to: [recipientEmail],
      subject: 'Réponse à votre demande - Asiacuisine.re',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://www.asiacuisine.re/favicon.png" style="width: 80px;">
          </div>
          <h2 style="color: #d4af37; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Votre demande Asiacuisine.re</h2>
          <p>Bonjour <strong>${recipientName}</strong>,</p>
          <div style="white-space: pre-line; background: #fafafa; padding: 20px; border-radius: 12px; border: 1px solid #eee;">
            ${messageBody}
          </div>
          <p style="margin-top: 30px; font-size: 13px; color: #888; text-align: center;">
            <strong>Asiacuisine.re</strong><br>
            Chef privé, cours de cuisine et plats à emporter
          </p>
        </div>
      `,
    });

    if (mailError) throw mailError;

    // 4. Mettre à jour le statut du dossier
    await supabase.from('demandes').update({ status: 'cancelled' }).eq('id', demandeId);

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
