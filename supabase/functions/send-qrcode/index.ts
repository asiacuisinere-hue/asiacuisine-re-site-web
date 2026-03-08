import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWeekNumber(d: Date): number {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
}

function getWeeklyColor(): string {
    const colors = ['2c3e50', 'c0392b', '2980b9', '27ae60', 'f39c12', '8e44ad', 'd35400'];
    const weekNumber = getWeekNumber(new Date());
    return colors[weekNumber % colors.length];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { demandeId, companySettings, amountPaid } = await req.json();
    if (!demandeId) throw new Error("ID de demande manquant.");
    if (!companySettings) throw new Error("Paramètres de l'entreprise manquants.");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const resend = new Resend(resendApiKey);

    // 1. Fetch Demande and Client details
    const { data: demande, error: demandeError } = await supabase
        .from('demandes')
        .select('id, request_date, type, total_amount, details_json, status, clients(*), entreprises (contact_email, nom_entreprise)')      
        .eq('id', demandeId)
        .single();
    if (demandeError) throw new Error(`Demande non trouvée: ${demandeError.message}`);

    const clientEmail = demande.clients?.email || demande.entreprises?.contact_email;
    const clientName = demande.clients?.first_name || demande.entreprises?.nom_entreprise || 'client';    
    if (!clientEmail) throw new Error('Email client non trouvé pour cette demande.');

    // 2. Prepare QR Code
    const displayDate = new Date(demande.request_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const urlDate = new Date(demande.request_date).toISOString().split('T')[0];
    const weeklyColor = getWeeklyColor();
    const qrData = encodeURIComponent(`https://www.asiacuisine.re/suivi?id=${demande.id}&date=${urlDate}`);
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&color=${weeklyColor}`;

    const qrCodeResponse = await fetch(qrCodeApiUrl);
    if (!qrCodeResponse.ok) throw new Error('Failed to fetch QR code image.');
    const qrCodeImageBuffer = await qrCodeResponse.arrayBuffer();
    const qrCodeBase64 = encodeBase64(qrCodeImageBuffer);

    // 3. Prepare Receipt Section
    const amount = amountPaid || demande.total_amount || 0;
    const formula = demande.details_json?.formulaName || 'Commande spéciale';
    const option = demande.details_json?.formulaOption ? `(${demande.details_json.formulaOption})` : '';

    const receiptHtml = amount > 0 ? `
        <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 10px; border: 1px solid #eee; text-align: left;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #888; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">Reçu de paiement</p>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 14px; color: #555;">Produit :</span>
                <span style="font-size: 14px; font-weight: bold; color: #333;">${formula} ${option}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-size: 14px; color: #555;">Montant réglé :</span>
                <span style="font-size: 16px; font-weight: 900; color: #27ae60;">${parseFloat(amount).toFixed(2)} €</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
                <span style="font-size: 14px; color: #555;">Mode :</span>
                <span style="font-size: 14px; color: #333;">Carte Bancaire (Stripe)</span>
            </div>
        </div>
    ` : '';

    // 4. Send Unified Email
    await resend.emails.send({
        from: `Asiacuisine.re <confirmation@asiacuisine.re>`,
        to: clientEmail,
        subject: `Confirmation et Reçu - Commande du ${displayDate}`,
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
                <div style="max-width: 450px; margin: auto; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    <div style="background-color: #${weeklyColor}; color: white; padding: 20px;">
                        <h1 style="margin: 0; font-size: 22px;">Merci pour votre commande !</h1>
                        <p style="margin: 5px 0 0 0; opacity: 0.8; font-size: 14px;">Commande du ${displayDate}</p>
                    </div>
                    <div style="padding: 30px 25px;">
                        <p style="color: #555; line-height: 1.5;">Bonjour <strong>${clientName}</strong>, votre paiement a bien été validé. Voici votre reçu et votre code de retrait.</p>
                        
                        ${receiptHtml}

                        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px dashed #eee;">
                            <p style="font-size: 14px; color: #333; margin-bottom: 15px;"><strong>Présentez ce code le jour de la réception :</strong></p>
                            <img src="cid:qrcode" alt="QR Code" style="width: 180px; height: 180px; margin: 0 auto; display: block;"/>
                            <p style="font-size: 1.2em; font-weight: bold; margin-top: 10px; letter-spacing: 3px; color: #${weeklyColor};">
                                ${demande.clients?.client_id || 'N/A'}
                            </p>
                        </div>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 20px; font-size: 12px; color: #999; border-top: 1px solid #eee;"> 
                        <strong>Asiacuisine.re</strong><br>
                        Chef privé & Menus asiatiques à La Réunion
                    </div>
                </div>
            </div>
        `,
        attachments: [{ filename: 'qrcode.png', content: qrCodeBase64, content_id: 'qrcode' }]
    });

    // 5. Update Demande Status
    await supabase.from('demandes').update({ status: 'En attente de préparation' }).eq('id', demandeId);

    return new Response(JSON.stringify({ success: true }), {  
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
