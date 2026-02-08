import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { format } from "https://deno.land/std@0.224.0/datetime/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { Resend } from 'https://esm.sh/resend@3.4.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders, status: 200 });

  try {
    const { quoteId } = await req.json();
    if (!quoteId) throw new Error('quoteId est manquant.');

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const { data: companySettings } = await supabase.from('company_settings').select('*').limit(1).single();
    const { data: quote, error: quoteError } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
    if (quoteError || !quote) throw new Error("Devis non trouvé.");

    // --- Identification Client ---
    let client;
    if (quote.demand_id) {
        const { data: demande } = await supabase.from('demandes').select('*, clients(*), entreprises(*)').eq('id', quote.demand_id).single();
        if (demande) client = demande.clients || demande.entreprises;
    } else if (quote.client_id) {
        const { data } = await supabase.from('clients').select('*').eq('id', quote.client_id).single();
        client = data;
    } else if (quote.entreprise_id) {
        const { data } = await supabase.from('entreprises').select('*').eq('id', quote.entreprise_id).single();
        client = data;
    }

    if (!client) throw new Error("Client non trouvé.");
    const customerEmail = client.email || client.contact_email;
    const customerName = client.first_name ? `${client.first_name} ${client.last_name}` : (client.nom_entreprise || client.contact_name || 'Client');

    // --- Préparation PDF ---
    const { data: fileData, error: downloadError } = await supabase.storage.from('documents').download(quote.storage_path);
    if (downloadError) throw new Error(`Erreur PDF: ${downloadError.message}`);
    const pdfBytes = await fileData.arrayBuffer();
    const pdfBase64 = encodeBase64(new Uint8Array(pdfBytes));

    // --- Bouton Acceptation ---
    const acceptUrl = `https://www.asiacuisine.re/accepter-devis.html?id=${quote.id}`;
    const acceptBlock = `
        <div style="margin: 30px 0; padding: 25px; background-color: #f8fdf9; border: 1px solid #d4edda; border-radius: 12px; text-align: center;">
            <p style="margin-bottom: 15px; color: #155724; font-weight: bold;">Action requise : Validation de votre réservation</p>
            <p style="margin-bottom: 20px; color: #555; font-size: 14px;">Si ce devis vous convient, merci de le valider en cliquant sur le bouton ci-dessous pour confirmer votre réservation :</p>
            <a href="${acceptUrl}" style="background-color: #28a745; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 16px;">Accepter et Valider le Devis</a>
        </div>
    `;

    // --- Envoi Email ---
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: `${companySettings.name} <facturation@asiacuisine.re>`,
      to: [customerEmail],
      reply_to: 'contact@asiacuisine.re',
      subject: `Votre devis ${companySettings.name} - N°${quote.document_number}`,   
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">    
          ${companySettings.logo_url ? `<div style="text-align: center; margin-bottom: 20px;"><img src="${companySettings.logo_url}" style="max-height: 70px;"></div>` : ''}
          <h2 style="color: #d4af37; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">Votre Devis</h2>
          <p>Bonjour ${customerName},</p>
          <p>Nous vous remercions pour l'intérêt que vous portez à nos services culinaires.</p>
          <p>Veuillez trouver ci-joint votre devis N° <strong>${quote.document_number}</strong>.</p>
          
          ${acceptBlock}

          <p>Ce devis est valable 30 jours. N'hésitez pas à nous solliciter pour toute modification.</p>
          <p>Cordialement,<br><strong>L'équipe ${companySettings.name}</strong></p>
        </div>
      `,
      attachments: [{ filename: `devis-${quote.document_number}.pdf`, content: pdfBase64 }],
    });

    // Mettre à jour le statut
    await supabase.from('quotes').update({ status: 'sent' }).eq('id', quoteId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
  }
});