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

// --- Helper Functions ---
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
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
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

    // --- Company & Customer Details ---
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
    y -= 24;
    page.drawText(`SIRET: ${companySettings.siret || ''}`, { x: textStartX, y, size: 9, font: fontBold, color: black });

    // --- Document Title & Info ---
    page.drawRectangle({ x: 440, y: height - 58, width: 105, height: 35, color: gold });
    page.drawText("FACTURE", { x: 452, y: height - 48, size: 18, font: fontBold, color: white });
    let yRight = height - 95;
    const docNumberText = `N°: ${invoice.document_number || invoice.id}`;
    page.drawText(docNumberText, { x: 545 - fontBold.widthOfTextAtSize(docNumberText, 10), y: yRight, size: 10, font: fontBold });
    yRight -= 14;
    const dateText = `Date: ${new Date(invoice.created_at).toLocaleDateString("fr-FR")}`;
    page.drawText(dateText, { x: 545 - font.widthOfTextAtSize(dateText, 9), y: yRight, size: 9, font, color: gray });

    // --- Customer Info ---
    const customer = invoice.clients || invoice.entreprises;
    if (customer) {
        const customerName = customer.last_name ? `${customer.first_name || ""} ${customer.last_name || ''}`.trim() : (customer.nom_entreprise || '');
        page.drawText(customerName, { x: 330, y: height - 152, size: 11, font: fontBold });
    }
    
    // --- Items Table ---
    y = height - 220; // Starting Y for items table
    if (invoice.items && Array.isArray(invoice.items)) {
        for (const item of invoice.items) {
            const desc = (item.description || item.name || "Service").substring(0, 45);
            page.drawText(desc, { x: 60, y, size: 10, font });
            page.drawText(String(item.quantity || 0), { x: 350, y, size: 10, font });
            page.drawText(`${(item.unit_price || 0).toFixed(2)} €`, { x: 400, y, size: 10, font });
            page.drawText(`${((item.unit_price || 0) * (item.quantity || 0)).toFixed(2)} €`, { x: 485, y, size: 10, font });
            y -= 25;
        }
    }

    // --- Totals ---
    y = 150; // Fixed Y for totals section
    page.drawText("TOTAL TTC:", { x: 365, y: y - 15, size: 12, font: fontBold });
    page.drawText(`${(invoice.total_amount || 0).toFixed(2)} €`, { x: 470, y: y - 15, size: 14, font: fontBold, color: gold });

    return await pdfDoc.save();
}

async function sendEmailWithResend(apiKey, toEmail, customerName, documentNumber, pdfBytes, companySettings) {
    const pdfBase64 = encodeBase64(pdfBytes);
    await fetch("https://api.resend.com/emails", {
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
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { demandeId } = await req.json();
    if (!demandeId) throw new Error("ID de demande manquant.");

    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const { data: companySettings } = await supabase.from('company_settings').select('*').limit(1).single();
    if (!companySettings) throw new Error("Paramètres de l'entreprise non trouvés.");

    const { data: demande, error: demandeError } = await supabase.from("demandes").select(`*, clients(*), entreprises(*)`).eq("id", demandeId).single();
    if (demandeError) throw new Error(`Erreur récupération demande: ${demandeError.message}`);

    let invoice;
    const { data: existingInvoice } = await supabase.from('invoices').select(`*`).eq('demande_id', demandeId).maybeSingle();

    if (existingInvoice) {
        invoice = existingInvoice;
    } else {
        const now = new Date();
        const year = format(now, "yyyy"), month = format(now, "MM"), week = getWeekNumber(now), dayOfWeek = now.getDay() || 7;
        const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true }).gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
        const docNum = `FR_${year}_${month}_${week}_${dayOfWeek}_${String((count || 0) + 1).padStart(4, "0")}_${randomString(6)}`;
        
        const formulaName = demande.details_json?.formulaName || 'N/A';
        const formulaPrices = { "Formule Découverte (39€)": 39, "Formule Standard (49€)": 49, "Formule Confort (59€)": 59, "Option Duo (94€)": 94 };
        const unitPrice = formulaPrices[formulaName] || 0;
        const total = unitPrice * (demande.details_json?.numberOfPeople || 1);

        const { data: newInvoice, error } = await supabase.from('invoices').insert({
            demande_id: demande.id,
            client_id: demande.client_id,
            entreprise_id: demande.entreprise_id,
            document_number: docNum,
            total_amount: total,
            status: 'pending',
            items: [{ name: formulaName, quantity: demande.details_json?.numberOfPeople || 1, unit_price: unitPrice }],
        }).select('*').single();
        if (error) throw error;
        invoice = newInvoice;
    }
    
    invoice.clients = demande.clients;
    invoice.entreprises = demande.entreprises;

    const pdfBytes = await generateInvoicePDF(invoice, companySettings);
    const customerEmail = demande.clients?.email || demande.entreprises?.contact_email;
    if (!customerEmail) throw new Error("Email du client non trouvé.");
    
    await sendEmailWithResend(resendApiKey, customerEmail, ``, invoice.document_number, pdfBytes, companySettings);
    await supabase.from('demandes').update({ status: 'En attente de paiement' }).eq('id', demandeId);

    const docName = invoice.document_number || invoice.id;
    const safeDocName = docName.replace(/_/g, "-");
    
    return new Response(pdfBytes, {
      headers: { 
          ...corsHeaders, 
          "Content-Type": "application/pdf", 
          "Content-Disposition": `attachment; filename="facture-${safeDocName}.pdf"; filename*=UTF-8''${encodeURIComponent(`facture-${docName}.pdf`)}`
      },
      status: 200,
    });

  } catch (err) {
    console.error("Error in send-invoice-by-email:", err.stack);
    return new Response(JSON.stringify({ error: err.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 });
  }
});