import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { format } from "https://deno.land/std@0.224.0/datetime/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

const getFrenchStatus = (status) => {
    switch (status) {
        case 'pending': return 'En attente';
        case 'deposit_paid': return 'Acompte versé';
        case 'paid': return 'Payée';
        case 'cancelled': return 'Annulée';
        default: return status;
    }
};

async function generateInvoicePDF(invoice, companySettings) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const gold = rgb(0.83, 0.69, 0.22);
    const black = rgb(0, 0, 0);
    const gray = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.95, 0.95, 0.95);
    const white = rgb(1, 1, 1);
    let y = height - 50;
    let textStartX = 50;

    try {
        if (companySettings.logo_url) {
            const logoResponse = await fetch(companySettings.logo_url);
            if (logoResponse.ok) {
                const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
                const logoImage = companySettings.logo_url.toLowerCase().includes('.png') ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
                const logoDims = logoImage.scale(65 / logoImage.height);
                page.drawImage(logoImage, { x: 50, y: y - logoDims.height + 20, width: logoDims.width, height: logoDims.height });
                textStartX = 50 + logoDims.width + 15;
            }
        }
    } catch (e) { console.error("Logo non chargé:", e.message); }

    page.drawText(companySettings.name || '', { x: textStartX, y, size: 18, font: fontBold, color: gold });
    y -= 18;
    page.drawText(companySettings.owner || '', { x: textStartX, y, size: 9, font, color: black });        
    y -= 12;
    page.drawText(companySettings.address || '', { x: textStartX, y, size: 9, font, color: gray });       
    y -= 12;
    page.drawText(companySettings.city || '', { x: textStartX, y, size: 9, font, color: gray });
    y -= 12;
    page.drawText(`Tél: ${companySettings.phone || ''} | ${companySettings.email || ''}`, { x: textStartX, y, size: 9, font, color: gray });
    y -= 12;
    page.drawText(`SIRET: ${companySettings.siret || ''}`, { x: textStartX, y, size: 9, font: fontBold, color: black });

    page.drawRectangle({ x: 440, y: height - 58, width: 105, height: 35, color: gold });
    page.drawText("FACTURE", { x: 452, y: height - 48, size: 18, font: fontBold, color: white });

    let yRight = height - 95;
    const docNumberText = `N°: ${invoice.document_number || invoice.id.substring(0,8)}`;
    page.drawText(docNumberText, { x: 545 - fontBold.widthOfTextAtSize(docNumberText, 10), y: yRight, size: 10, font: fontBold });
    yRight -= 14;
    const dateText = `Date: ${new Date(invoice.created_at).toLocaleDateString("fr-FR")}`;
    page.drawText(dateText, { x: 545 - font.widthOfTextAtSize(dateText, 9), y: yRight, size: 9, font, color: gray });
    yRight -= 14;
    const statusText = `Statut: ${getFrenchStatus(invoice.status)}`;
    page.drawText(statusText, { x: 545 - font.widthOfTextAtSize(statusText, 9), y: yRight, size: 9, font, color: gray });

    y = height - 125;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 2, color: gold });

    y -= 30;
    const customer = invoice.clients || invoice.entreprises;
    if (customer) {
        page.drawRectangle({ x: 320, y: y - 55, width: 225, height: 75, color: lightGray });
        page.drawText("DESTINATAIRE", { x: 330, y: y - 5, size: 10, font: fontBold, color: gold });       
        const customerName = customer.last_name ? `${customer.first_name || ""} ${customer.last_name || ''}`.trim() : (customer.nom_entreprise || '');
        page.drawText(customerName, { x: 330, y: y - 22, size: 11, font: fontBold, color: black });       
        const customerEmail = customer.email || customer.contact_email;
        if (customerEmail) page.drawText(customerEmail, { x: 330, y: y - 50, size: 9, font, color: gray });
    }

    y = height - 250;
    page.drawRectangle({ x: 50, y: y, width: 495, height: 28, color: gold });
    page.drawText("Description", { x: 60, y: y + 10, size: 10, font: fontBold, color: white });
    page.drawText("Qté", { x: 340, y: y + 10, size: 10, font: fontBold, color: white });
    page.drawText("Prix unit.", { x: 400, y: y + 10, size: 10, font: fontBold, color: white });
    page.drawText("Total", { x: 490, y: y + 10, size: 10, font: fontBold, color: white });
    y -= 10;

    if (invoice.items && Array.isArray(invoice.items)) {
        let rowIndex = 0;
        for (const item of invoice.items) {
            const rowColor = rowIndex % 2 === 0 ? white : lightGray;
            page.drawRectangle({ x: 50, y: y - 25, width: 495, height: 25, color: rowColor });
            const desc = (item.description || item.name || "Service").substring(0, 45);
            page.drawText(desc, { x: 60, y: y - 10, size: 10, font, color: black });
            page.drawText(String(item.quantity || 0), { x: 350, y: y - 10, size: 10, font, color: black });
            page.drawText(`${(item.unit_price || 0).toFixed(2)} €`, { x: 400, y: y - 10, size: 10, font, color: black });
            page.drawText(`${((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)} €`, { x: 485, y: y - 10, size: 10, font, color: black });
            y -= 25;
            rowIndex++;
            if (y < 150) break;
        }
    }

    y -= 15;
    const totalAmount = parseFloat(invoice.total_amount) || 0;
    const depositAmount = parseFloat(invoice.deposit_amount) || 0;
    const boxHeight = (depositAmount > 0) ? 80 : 50;

    page.drawRectangle({ x: 350, y: y - boxHeight + 20, width: 195, height: boxHeight, color: rgb(0.98, 0.98, 0.98), borderColor: gold, borderWidth: 1 });

    let totalsY = y;
    page.drawText("TOTAL TTC:", { x: 365, y: totalsY, size: 12, font: fontBold });
    page.drawText(`${totalAmount.toFixed(2)} €`, { x: 470, y: totalsY, size: 14, font: fontBold, color: gold });

    if (depositAmount > 0) {
        const remaining = totalAmount - depositAmount;
        totalsY -= 25;
        page.drawText("Acompte Versé:", { x: 365, y: totalsY, size: 10, font: fontBold });
        page.drawText(`- ${depositAmount.toFixed(2)} €`, { x: 470, y: totalsY, size: 10, font });       
        totalsY -= 25;
        page.drawText(remaining > 0 ? "RESTE À PAYER:" : "SOLDE PAYÉ:", { x: 365, y: totalsY, size: 11, font: fontBold });
        page.drawText(`${remaining.toFixed(2)} €`, { x: 470, y: totalsY, size: 12, font: fontBold, color: gold });
    }

    return await pdfDoc.save();
}

async function sendEmailWithResend(apiKey, toEmail, customerName, invoice, pdfBytes, companySettings, stripeUrl) {
    const pdfBase64 = encodeBase64(pdfBytes);
    const documentNumber = invoice.document_number || invoice.id.substring(0,8);

    let paymentMessage = "";
    if (stripeUrl) {
        const amountToPay = invoice.status === 'pending' ? (invoice.total_amount * 0.30).toFixed(2) : (invoice.total_amount - (invoice.deposit_amount || 0)).toFixed(2);
        const typeLabel = invoice.status === 'pending' ? "l'acompte de 30%" : "le solde restant";

        paymentMessage = `
            <div style="margin: 25px 0; padding: 20px; background-color: #f8f9ff; border: 1px solid #e0e4ff; border-radius: 12px; text-align: center;">
                <p style="margin-bottom: 15px; color: #333; font-weight: bold;">Action requise : Paiement sécurisé</p>
                <p style="margin-bottom: 20px; color: #666;">Pour confirmer votre réservation, merci de régler ${typeLabel} (${amountToPay}€) via le bouton ci-dessous :</p>
                <a href="${stripeUrl}" style="background-color: #635bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Régler ${amountToPay}€ par Carte / Apple Pay</a>
            </div>
        `;
    }

    const htmlContent = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <p>Bonjour ${customerName},</p>
            <p>Veuillez trouver ci-joint votre facture N° <strong>${documentNumber}</strong>.</p>        
            ${paymentMessage}
            <p>Cordialement,<br>L'équipe ${companySettings.name}</p>
        </div>
    `;

    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: `${companySettings.name} <facturation@asiacuisine.re>`,
            to: [toEmail],
            reply_to: 'contact@asiacuisine.re',
            subject: `Votre facture ${companySettings.name} - ${documentNumber}`,
            html: htmlContent,
            attachments: [{ filename: `facture-${documentNumber}.pdf`, content: pdfBase64 }],
        }),
    });
    return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") { return new Response('ok', { headers: corsHeaders }); }
  try {
    const { invoiceId, stripeUrl } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const { data: companySettings } = await supabase.from('company_settings').select('*').limit(1).single();

    const { data: invoice, error } = await supabase.from("invoices").select(`*, clients(*), entreprises(*)`).eq("id", invoiceId).single();
    if (error || !invoice) throw new Error("Facture non trouvée.");

    const pdfBytes = await generateInvoicePDF(invoice, companySettings);
    
    const customerEmail = invoice.clients?.email || invoice.entreprises?.contact_email;
    const customerName = invoice.clients ? `${invoice.clients.first_name || ""} ${invoice.clients.last_name}`.trim() : invoice.entreprises?.nom_entreprise || "";

    await sendEmailWithResend(resendApiKey ?? "", customerEmail, customerName, invoice, pdfBytes, companySettings, stripeUrl);

    // --- NOUVEAU : Enregistrer la date d'envoi ---
    await supabase.from("invoices").update({ last_email_sent_at: new Date().toISOString() }).eq("id", invoiceId);

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});
