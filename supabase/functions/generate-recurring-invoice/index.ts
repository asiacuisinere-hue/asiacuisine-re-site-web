import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Helper Functions (copied from send-invoice-by-email) ---

const getFrenchStatus = (status) => {
    switch (status) {
        case 'pending': return 'En attente';
        case 'deposit_paid': return 'Acompte versé';
        case 'paid': return 'Payée';
        case 'cancelled': return 'Annulée';
        default: return status;
    }
};

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function randomString(length) {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < length; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
}

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
    } catch (e) { console.error("Logo not loaded:", e.message); }

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
    const docNumberText = `N°: ${invoice.document_number || invoice.id}`;
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
        for (const item of invoice.items) {
            page.drawRectangle({ x: 50, y: y - 25, width: 495, height: 25, color: white });
            const desc = (item.description || item.name || "Service").substring(0, 45);
            page.drawText(desc, { x: 60, y: y - 10, size: 10, font, color: black });
            page.drawText(String(item.quantity || 0), { x: 350, y: y - 10, size: 10, font, color: black });
            page.drawText(`${(item.unit_price || 0).toFixed(2)} €`, { x: 400, y: y - 10, size: 10, font, color: black });
            page.drawText(`${((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)} €`, { x: 485, y: y - 10, size: 10, font, color: black });
            y -= 25;
        }
    }

    y -= 15;
    const totalAmount = parseFloat(invoice.total_amount) || 0;
    page.drawRectangle({ x: 350, y: y - 30, width: 195, height: 50, color: rgb(0.98, 0.98, 0.98), borderColor: gold, borderWidth: 1 });
    page.drawText("TOTAL TTC:", { x: 365, y: y, size: 12, font: fontBold });
    page.drawText(`${totalAmount.toFixed(2)} €`, { x: 470, y: y, size: 14, font: fontBold, color: gold });

    page.drawText(companySettings.tva_message || '', { x: 50, y: y - 15, size: 8, font, color: gray });

    y -= 80;
    page.drawText(`Conditions: ${companySettings.payment_conditions || 'Paiement à la commande'}`, { x: 300, y: y, size: 9, font, color: gray });
    page.drawText(`Moyens: ${companySettings.payment_methods || 'Virement, Espèces, CB'}`, { x: 300, y: y - 13, size: 9, font, color: gray });
    y -= 26;
    page.drawText("Pour les virements :", { x: 300, y: y, size: 9, font: fontBold, color: black });
    y -= 13;
    page.drawText("Établissement: 20041", { x: 300, y: y, size: 9, font, color: gray });
    y -= 13;
    page.drawText("Guichet: 01021", { x: 300, y: y, size: 9, font, color: gray });
    y -= 13;
    page.drawText("N° Compte: 0941814D018", { x: 300, y: y, size: 9, font, color: gray });
    y -= 13;
    page.drawText("Clé RIB: 29", { x: 300, y: y, size: 9, font, color: gray });
    y -= 13;
    page.drawText("Domiciliation: LA BANQUE POSTALE ST DENIS CENTRE FINANCIER", { x: 300, y: y, size: 8, font, color: gray });

    page.drawLine({ start: { x: 50, y: 45 }, end: { x: 545, y: 45 }, thickness: 1, color: gold });
    const companyInfoString = `${companySettings.name || ''} | ${companySettings.owner || ''} | SIRET: ${companySettings.siret || ''} | ${companySettings.website || ''}`;
    const companyInfoWidth = font.widthOfTextAtSize(companyInfoString, 8);
    page.drawText(companyInfoString, { x: (page.getWidth() - companyInfoWidth) / 2, y: 30, size: 8, font, color: gray });
    page.drawText("Merci de votre confiance !", { x: 240, y: 18, size: 8, font: fontBold, color: gold });

    return await pdfDoc.save();
}

async function sendEmailWithResend(apiKey, toEmail, customerName, documentNumber, pdfBytes, companySettings) {
    const pdfBase64 = encodeBase64(pdfBytes);
    const resend = new Resend(apiKey);
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            from: `${companySettings.name} <facturation@asiacuisine.re>`,
            to: [toEmail],
            subject: `Votre facture ${companySettings.name} - ${documentNumber}`,
            html: `<p>Bonjour ${customerName},</p><p>Veuillez trouver ci-joint votre facture N° <strong>${documentNumber}</strong>.</p><p>Cordialement,<br>L'équipe ${companySettings.name}</p>`,
            attachments: [{ filename: `facture-${documentNumber}.pdf`, content: pdfBase64 }],
        }),
    });
    const data = await response.json();
    if (!response.ok || data.error) {
        console.error("Resend error:", data.error);
        throw new Error(data.error?.message || "Erreur lors de l'envoi de l'email");
    }
    return data;
}

// --- Main Function ---

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response('ok', { headers: corsHeaders });
    }
    try {
        const { abonnementId } = await req.json();
        if (!abonnementId) throw new Error("ID de l'abonnement manquant.");

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Fetch all necessary data in parallel
        const [
            { data: subscription, error: subError },
            { data: companySettings, error: companySettingsError }
        ] = await Promise.all([
            supabase.from('abonnements').select(`*, clients(*), entreprises(*)`).eq('id', abonnementId).single(),
            supabase.from('company_settings').select('*').limit(1).single()
        ]);
        
        if (subError) throw new Error(`Abonnement non trouvé: ${subError.message}`);
        if (companySettingsError) throw new Error(`Paramètres de l'entreprise non trouvés: ${companySettingsError.message}`);
        if (!subscription.monthly_price || subscription.monthly_price <= 0) {
            throw new Error("Le prix mensuel pour cet abonnement n'est pas défini ou est invalide.");
        }

        // 2. Generate a new invoice number
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const week = getWeekNumber(now);
        const dayOfWeek = now.getDay() || 7;
        const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true }).gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
        const docNum = `FA_${year}_${month}_${week}_${dayOfWeek}_${String((count || 0) + 1).padStart(4, "0")}_${randomString(6)}`;

        // 3. Create the invoice payload
        const invoiceItemDescription = `Abonnement Formule ${subscription.formule_base} - ${now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;
        const invoicePayload = {
            demand_id: subscription.original_demand_id,
            client_id: subscription.client_id,
            entreprise_id: subscription.entreprise_id,
            document_number: docNum,
            total_amount: subscription.monthly_price,
            status: 'pending',
            items: [{ name: invoiceItemDescription, quantity: 1, unit_price: subscription.monthly_price }]
        };

        // 4. Insert the new invoice
        const { data: newInvoice, error: invoiceError } = await supabase.from('invoices').insert(invoicePayload).select().single();
        if (invoiceError) throw new Error(`Erreur lors de la création de la facture: ${invoiceError.message}`);

        // 5. Update the subscription with new billing dates
        const nextBillingDate = new Date(subscription.next_billing_date || now);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        const { error: updateSubError } = await supabase.from('abonnements').update({
            last_invoice_date: new Date().toISOString(),
            next_billing_date: nextBillingDate.toISOString().split('T')[0]
        }).eq('id', abonnementId);
        if (updateSubError) {
            console.error(`Could not update subscription billing dates for ${abonnementId}: ${updateSubError.message}`);
        }
        
        // 6. Generate PDF and send email
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
            // Attach client/entreprise data to the invoice object for the PDF/email functions
            newInvoice.clients = subscription.clients;
            newInvoice.entreprises = subscription.entreprises;

            const pdfBytes = await generateInvoicePDF(newInvoice, companySettings);
            const customerEmail = subscription.clients?.email || subscription.entreprises?.contact_email;
            const customerName = subscription.clients ? `${subscription.clients.first_name || ""} ${subscription.clients.last_name}`.trim() : subscription.entreprises?.nom_entreprise || "";

            if (customerEmail && customerName) {
                await sendEmailWithResend(resendApiKey, customerEmail, customerName, newInvoice.document_number, pdfBytes, companySettings);
            } else {
                console.error(`Email or name missing for subscription ${subscription.id}, cannot send email.`);
            }
        }

        return new Response(JSON.stringify({ success: true, message: `Facture ${newInvoice.document_number} créée et envoyée avec succès.` }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });

    } catch (error) {
        console.error('Error in generate-recurring-invoice:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
