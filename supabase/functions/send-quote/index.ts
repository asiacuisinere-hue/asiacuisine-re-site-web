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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    console.log('[send-quote] Function invoked');
    
    const { quoteId } = await req.json();
    console.log('[send-quote] QuoteId received:', quoteId);
    
    if (!quoteId) throw new Error('quoteId est manquant.');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 0. Récupérer les paramètres de l'entreprise
    console.log('[send-quote] Fetching company settings...');
    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError) {
      console.error('[send-quote] Error fetching company settings:', settingsError);
      throw new Error(`Impossible de récupérer les paramètres : ${settingsError.message}`);
    }

    console.log('[send-quote] Company settings:', companySettings?.name);

    // 1. Récupérer le devis lui-même
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError) throw quoteError;
    if (!quote) throw new Error("Devis non trouvé.");

    console.log('[send-quote] Quote found:', quote.document_number);
    console.log('[send-quote] Quote has demand_id:', !!quote.demand_id);
    console.log('[send-quote] Quote has client_id:', !!quote.client_id);
    console.log('[send-quote] Quote has entreprise_id:', !!quote.entreprise_id);

    // 2. Récupérer les informations client de manière robuste
    let client;
    let customerEmail;
    let customerName = 'Client';
    
    if (quote.demand_id) {
        console.log('[send-quote] Devis lié à une demande, récupération via la demande...');
        const { data: demande, error: demandeError } = await supabase
            .from('demandes')
            .select('*, clients(*), entreprises(*)')
            .eq('id', quote.demand_id)
            .single();
        
        if (!demandeError && demande) {
            client = demande.clients || demande.entreprises;
            console.log('[send-quote] Client found via demande:', {
                has_clients: !!demande.clients,
                has_entreprises: !!demande.entreprises
            });
        }
    } else if (quote.client_id) {
        console.log('[send-quote] Devis direct, récupération via client_id...');
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', quote.client_id)
            .single();
        if (!error) client = data;
    } else if (quote.entreprise_id) {
        console.log('[send-quote] Devis direct, récupération via entreprise_id...');
        const { data, error } = await supabase
            .from('entreprises')
            .select('*')
            .eq('id', quote.entreprise_id)
            .single();
        if (!error) client = data;
    }

    if (!client) {
      throw new Error("Client ou entreprise lié au devis non trouvé.");
    }

    console.log('[send-quote] Client data retrieved:', {
      has_first_name: !!client.first_name,
      has_last_name: !!client.last_name,
      has_nom_entreprise: !!client.nom_entreprise,
      has_email: !!(client.email || client.contact_email)
    });

    // 3. Déterminer email et nom du client
    customerEmail = client.email || client.contact_email;
    
    if (client.first_name || client.last_name) {
        customerName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
        console.log('[send-quote] Client type: Particulier, name:', customerName);
    } else if (client.nom_entreprise) {
        customerName = client.nom_entreprise;
        console.log('[send-quote] Client type: Entreprise, name:', customerName);
    } else if (client.contact_name) {
        customerName = client.contact_name;
        console.log('[send-quote] Using contact_name as fallback:', customerName);
    }

    console.log('[send-quote] Final customer name:', customerName);
    console.log('[send-quote] Final customer email:', customerEmail);

    if (!customerEmail) {
      throw new Error("Aucune adresse email trouvée pour le client.");
    }

    if (!quote.storage_path) {
      throw new Error("Le document PDF n'a pas été trouvé pour ce devis.");
    }

    // 4. Télécharger le PDF depuis le storage
    console.log('[send-quote] Downloading PDF from storage...');
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(quote.storage_path);
      
    if (downloadError) {
      console.error('[send-quote] Download error:', downloadError);
      throw new Error(`Impossible de télécharger le PDF: ${downloadError.message}`);
    }

    console.log('[send-quote] PDF downloaded, size:', fileData.size);

    // 5. Convertir en Base64
    const pdfBytes = await fileData.arrayBuffer();
    const pdfBase64 = encodeBase64(new Uint8Array(pdfBytes));
    console.log('[send-quote] PDF converted to base64, length:', pdfBase64.length);

    // 6. Vérifier la clé API Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error("Clé API Resend non configurée.");
    }
    
    console.log('[send-quote] Sending email via Resend...');
    
    const resend = new Resend(resendApiKey);
    
    const emailPayload = {
      from: `${companySettings.name || 'Asiacuisine.re'} <facturation@asiacuisine.re>`,
      to: [customerEmail],
      subject: `Votre devis ${companySettings.name || 'Asiacuisine.re'} - N°${quote.document_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${companySettings.logo_url ? `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${companySettings.logo_url}" alt="${companySettings.name || 'Asiacuisine.re'}" style="max-height: 80px;">
          </div>
          ` : ''}
          <h2 style="color: #d4af37; margin-bottom: 20px;">Votre Devis</h2>
          <p>Bonjour ${customerName},</p>
          <p>Nous vous remercions pour votre intérêt envers nos services.</p>
          <p>Veuillez trouver ci-joint votre devis N° <strong>${quote.document_number}</strong>.</p>
          <p>Ce devis est valable <strong>30 jours</strong> à compter de sa date d'émission.</p>
          <p>N'hésitez pas à nous contacter pour toute question ou pour confirmer votre réservation.</p>
          <br>
          <p>Cordialement,</p>
          <p><strong>L'équipe ${companySettings.name || 'Asiacuisine.re'}</strong></p>
          <hr style="border: none; border-top: 2px solid #d4af37; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            ${companySettings.address || ''}<br>
            ${companySettings.phone ? `Tél: ${companySettings.phone}` : ''} ${companySettings.email ? `| <a href="mailto:${companySettings.email}">${companySettings.email}</a>` : ''}<br>
            ${companySettings.website ? `<a href="${companySettings.website}" target="_blank">${companySettings.website}</a>` : ''}
          </p>
        </div>
      `,
      attachments: [{
        filename: `devis-${quote.document_number}.pdf`,
        content: pdfBase64,
      }],
    };

    console.log('[send-quote] Email payload prepared:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      hasAttachment: !!emailPayload.attachments?.[0],
      attachmentSize: pdfBase64.length,
      customerNameInEmail: customerName
    });

    // 7. Envoyer l'email
    const { data: emailData, error: emailError } = await resend.emails.send(emailPayload);
    
    if (emailError) {
      console.error('[send-quote] Resend error:', emailError);
      throw new Error(`Erreur Resend: ${emailError.message || JSON.stringify(emailError)}`);
    }

    console.log('[send-quote] Email sent successfully, ID:', emailData?.id);

    // 8. Mettre à jour le statut du devis
    console.log('[send-quote] Updating quote status...');
    const { error: updateError } = await supabase
      .from('quotes')
            .update({ 
              status: 'sent'
            })      .eq('id', quoteId);

    if (updateError) {
      console.error('[send-quote] Update error:', updateError);
      throw updateError;
    }

    console.log('[send-quote] Quote status updated successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Devis envoyé avec succès.',
        emailId: emailData?.id,
        sentTo: customerEmail,
        customerName: customerName
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[send-quote] Erreur finale:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
