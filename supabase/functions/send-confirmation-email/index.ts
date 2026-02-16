import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from 'https://esm.sh/resend@3.4.0';
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { demandeId, quoteId, invoiceId, type } = body;
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { data: company } = await supabase.from('company_settings').select('*').limit(1).single();

    const footerHtml = `
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; line-height: 1.5;">
            <p style="margin: 0; font-weight: bold; color: #666;">${company.name}</p>
            <p style="margin: 0;">📍 ${company.address || 'La Réunion'}</p>
            <p style="margin: 0;">📞 ${company.phone || ''} | ✉️ contact@asiacuisine.re</p>
            <p style="margin: 5px 0 0 0;"><a href="https://www.asiacuisine.re" style="color: #d4af37; text-decoration: none;">www.asiacuisine.re</a></p>
        </div>
    `;

    // --- CAS 1 : ACCUSÉ DE RÉCEPTION SIMPLE ---
    if (type === 'acknowledgement' || (demandeId && !invoiceId)) {
        const { data: demande } = await supabase.from('demandes').select('*').eq('id', demandeId || quoteId).single();
        if (!demande) throw new Error("Demande introuvable.");

        let client = null;
        if (demande.client_id) {
            const { data } = await supabase.from('clients').select('*').eq('id', demande.client_id).single();
            client = data;
        } else if (demande.entreprise_id) {
            const { data } = await supabase.from('entreprises').select('*').eq('id', demande.entreprise_id).single();
            client = data;
        }

        if (!client) throw new Error("Client lié introuvable.");

        const customerEmail = client.email || client.contact_email;
        const customerName = client.first_name ? `${client.first_name} ${client.last_name}` : (client.nom_entreprise || 'Client');

        await resend.emails.send({
            from: `${company.name} <contact@asiacuisine.re>`,
            to: [customerEmail],
            reply_to: 'contact@asiacuisine.re',
            subject: `Demande reçue - ${company.name}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; color: #333; line-height: 1.6;">
                    ${company.logo_url ? `<div style="text-align:center; margin-bottom:20px;"><img src="${company.logo_url}" style="max-height:60px;"></div>` : ''}
                    <h2 style="color: #d4af37; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">Merci pour votre demande !</h2>
                    <p>Bonjour <strong>${customerName}</strong>,</p>
                    <p>Nous avons bien reçu votre demande et nous vous en remercions.</p>
                    <p>Votre dossier est actuellement <strong>en cours de traitement</strong> par le Chef. Nous étudions vos besoins et reviendrons vers vous très rapidement pour finaliser les détails ensemble.</p>
                    <p>À bientôt !</p>
                    ${footerHtml}
                </div>
            `
        });

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // --- CAS 2 : CONFIRMATION APRÈS SIGNATURE ---
    if (!quoteId || !invoiceId) throw new Error("ID manquants.");

    const { data: quote } = await supabase.from('quotes').select('*, clients(*), entreprises(*)').eq('id', quoteId).single();
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();

    const clientFull = quote.clients || quote.entreprises;
    const customerEmailFull = clientFull.email || clientFull.contact_email;
    const customerNameFull = clientFull.first_name ? `${clientFull.first_name} ${clientFull.last_name}` : (clientFull.nom_entreprise || 'Client');

    const stripeRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/create-stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ invoice_id: invoiceId, amount_type: 'deposit' })
    });
    const stripeData = await stripeRes.json();
    const checkoutUrl = stripeData.url || `https://www.asiacuisine.re/paiement?id=${invoiceId}`;

    const { data: quoteFile } = await supabase.storage.from('documents').download(quote.storage_path);
    const quoteBase64 = quoteFile ? encodeBase64(new Uint8Array(await quoteFile.arrayBuffer())) : null;

    await resend.emails.send({
      from: `${company.name} <facturation@asiacuisine.re>`,
      to: [customerEmailFull],
      bcc: ['contact@asiacuisine.re'],
      subject: `Réservation confirmée - Devis #${quote.document_number}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
          ${company.logo_url ? `<div style="text-align:center; margin-bottom:20px;"><img src="${company.logo_url}" style="max-height:60px;"></div>` : ''}
          <h2 style="color: #d4af37; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">Réservation validée !</h2>
          <p>Bonjour <strong>${customerNameFull}</strong>,</p>
          <p>Nous avons bien reçu votre <strong>approbation signée</strong> pour le devis #${quote.document_number}.</p>
          <p>Veuillez trouver ci-joint votre exemplaire du <strong>devis signé</strong>.</p>
          
          <div style="margin: 35px 0; padding: 25px; background: #fdfcf8; border: 1px solid #d4af37; border-radius: 16px; text-align: center;">
            <p style="font-weight: bold; margin-bottom: 15px;">Pour bloquer définitivement la date, merci de régler l'acompte :</p>
            <a href="${checkoutUrl}" style="background: #1a1a1a; color: white; padding: 15px 35px; text-decoration: none; border-radius: 12px; font-weight: bold; display: inline-block;">PAYER L'ACOMPTE EN LIGNE</a>
          </div>

          <p>Merci pour votre confiance !</p>
          ${footerHtml}
        </div>
      `,
      attachments: [{ filename: `Devis_Signe_${quote.document_number}.pdf`, content: quoteBase64 }]
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
