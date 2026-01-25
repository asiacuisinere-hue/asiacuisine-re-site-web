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
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { demandeId, companySettings } = await req.json();
    if (!demandeId) throw new Error("ID de demande manquant.");
    if (!companySettings) throw new Error("Paramètres de l'entreprise manquants.");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const resend = new Resend(resendApiKey);

    // 1. Fetch Demande and Client details
    const { data: demande, error: demandeError } = await supabase
        .from('demandes')
        .select('id, request_date, status, clients(*), entreprises (contact_email, nom_entreprise)')
        .eq('id', demandeId)
        .single();
    if (demandeError) throw new Error(`Demande non trouvée: ${demandeError.message}`);

    const clientEmail = demande.clients?.email || demande.entreprises?.contact_email;
    const clientName = demande.clients?.first_name || demande.entreprises?.nom_entreprise || 'client';
    if (!clientEmail) throw new Error('Email client non trouvé pour cette demande.');

    // 2. Send QR Code Email
    const displayDate = new Date(demande.request_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const urlDate = new Date(demande.request_date).toISOString().split('T')[0];
    const weeklyColor = getWeeklyColor();
    const qrData = encodeURIComponent(`https://www.asiacuisine.re/suivi?id=${demande.id}&date=${urlDate}`);
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&color=${weeklyColor}`;

    // --- Fetch QR code image to embed it directly ---
    const qrCodeResponse = await fetch(qrCodeApiUrl);
    if (!qrCodeResponse.ok) throw new Error('Failed to fetch QR code image.');
    const qrCodeImageBuffer = await qrCodeResponse.arrayBuffer();
    const qrCodeBase64 = encodeBase64(qrCodeImageBuffer);

    await resend.emails.send({
        from: `${companySettings.name || 'Asiacuisine.re'} <qrcode@asiacuisine.re>`,
        to: clientEmail,
        subject: `Votre QR code pour votre commande du ${displayDate}`,
        html: `
            <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
                <div style="max-width: 400px; margin: auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <div style="background-color: #${weeklyColor}; color: white; padding: 15px;">
                        <h1 style="margin: 0; font-size: 20px;">Commande du ${displayDate}</h1>
                    </div>
                    <div style="padding: 30px 20px;">
                        <p>Bonjour ${clientName},</p>
                        <p>Veuillez présenter le QR code ci-dessous lors de la réception de votre commande.</p>
                        <img src="cid:qrcode" alt="QR Code de suivi" style="width: 200px; height: 200px; margin: 20px auto; display: block;"/>
                        <p style="font-size: 1.4em; font-weight: bold; margin-top: 10px; letter-spacing: 2px;">
                            ${demande.clients?.client_id || 'N/A'}
                        </p>
                    </div>
                    <div style="background-color: #f9f9f9; padding: 15px; font-size: 12px; color: #666;">
                        L'équipe Asiacuisine.re
                    </div>
                </div>
            </div>
        `,
        attachments: [
            {
                filename: 'qrcode.png',
                content: qrCodeBase64,
                content_id: 'qrcode', // Correspond au cid:qrcode dans le HTML
            }
        ]
    });

    // 3. Update Demande Status
    const { error: updateError } = await supabase
        .from('demandes')
        .update({ status: 'En attente de préparation' })
        .eq('id', demandeId);
    if (updateError) throw new Error(`Failed to update status: ${updateError.message}`);

    return new Response(JSON.stringify({ success: true, message: 'QR Code sent and status updated' }), {
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
