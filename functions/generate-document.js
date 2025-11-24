import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Helper function to add CORS headers
const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
};

// =============================================
// PDF Generation for RESERVATION_SERVICE (professional layout)
// =============================================
async function generateProfessionalInvoicePDF(invoice, companySettings, documentType = 'Facture') {
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
                const logoImage = companySettings.logo_url.toLowerCase().includes('.png')
                    ? await pdfDoc.embedPng(logoBytes)
                    : await pdfDoc.embedJpg(logoBytes);
                const logoHeight = 65;
                const logoDims = logoImage.scale(logoHeight / logoImage.height);
                page.drawImage(logoImage, { x: 50, y: y - logoDims.height + 20, width: logoDims.width, height: logoDims.height });
                textStartX = 50 + logoDims.width + 15;
            }
        }
    } catch (e) {
        console.error("Logo non chargé:", e.message);
    }

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

    page.drawRectangle({ x: 440, y: height - 58, width: 110, height: 35, color: gold });
    page.drawText(documentType.toUpperCase(), { x: 452, y: height - 48, size: 18, font: fontBold, color: white });

    let yRight = height - 95;
    const docNumberText = `N°: ${invoice.document_number || ''}`;
    const docNumberWidth = fontBold.widthOfTextAtSize(docNumberText, 10);
    page.drawText(docNumberText, { x: 545 - docNumberWidth, y: yRight, size: 10, font: fontBold, color: black });
    yRight -= 14;

    const dateText = `Date: ${new Date(invoice.created_at).toLocaleDateString("fr-FR")}`;
    const dateTextWidth = font.widthOfTextAtSize(dateText, 9);
    page.drawText(dateText, { x: 545 - dateTextWidth, y: yRight, size: 9, font, color: gray });

    y -= 25;
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 2, color: gold });

    y -= 30;
    const customer = invoice.clients || invoice.entreprises;
    page.drawRectangle({ x: 320, y: y - 55, width: 225, height: 75, color: lightGray });
    page.drawText("DESTINATAIRE", { x: 330, y: y - 5, size: 10, font: fontBold, color: gold });
    const customerName = customer.last_name ? `${customer.first_name || ""} ${customer.last_name || ''}`.trim() : (customer.nom_entreprise || '');
    page.drawText(customerName, { x: 330, y: y - 22, size: 11, font: fontBold, color: black });
    const customerEmail = customer.email || customer.contact_email;
    if (customerEmail) page.drawText(customerEmail || '', { x: 330, y: y - 50, size: 9, font, color: gray });

    y -= 95;
    page.drawRectangle({ x: 50, y: y - 8, width: 495, height: 28, color: gold });
    page.drawText("Description", { x: 60, y, size: 10, font: fontBold, color: white });
    page.drawText("Qté", { x: 340, y, size: 10, font: fontBold, color: white });
    page.drawText("Prix unit.", { x: 400, y, size: 10, font: fontBold, color: white });
    page.drawText("Total", { x: 490, y, size: 10, font: fontBold, color: white });
    y -= 35;

    let rowIndex = 0;
    for (const item of (invoice.items || [])) {
        if (rowIndex % 2 === 0) page.drawRectangle({ x: 50, y: y - 8, width: 495, height: 25, color: lightGray });
        const desc = (item.description || item.name || "Service").substring(0, 45);
        page.drawText(desc, { x: 60, y, size: 10, font, color: black });
        page.drawText(String(item.quantity || 0), { x: 350, y, size: 10, font, color: black });
        page.drawText(`${(item.unit_price || 0).toFixed(2)} €`, { x: 400, y, size: 10, font, color: black });
        page.drawText(`${((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)} €`, { x: 485, y, size: 10, font, color: black });
        y -= 25;
        rowIndex++;
        if (y < 200) break;
    }

    y -= 15;
    page.drawRectangle({ x: 350, y: y - 35, width: 195, height: 50, color: rgb(0.98, 0.98, 0.98), borderColor: gold, borderWidth: 2 });
    page.drawText("TOTAL TTC:", { x: 365, y: y - 15, size: 12, font: fontBold, color: black });
    page.drawText(`${(invoice.total_amount || 0).toFixed(2)} €`, { x: 470, y: y - 15, size: 14, font: fontBold, color: gold });
    
    page.drawText(companySettings.tva_message || '', { x: 50, y: y - 25, size: 8, font, color: gray });

    page.drawLine({ start: { x: 50, y: 45 }, end: { x: 545, y: 45 }, thickness: 1, color: gold });
    page.drawText(`${companySettings.name || ''} | ${companySettings.owner || ''} | SIRET: ${companySettings.siret || ''} | ${companySettings.website || ''}`, { x: 95, y: 30, size: 8, font, color: gray });
    
    return await pdfDoc.save();
}

// --- Main Handler ---
export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    try {
        const { demandeId, documentType, sendEmail } = await context.request.json();
        if (!demandeId || !documentType) throw new Error('Missing required fields');

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        const { data: demande, error: demandeError } = await supabase.from('demandes').select('type, details_json, clients(*), entreprises(*)').eq('id', demandeId).single();
        if (demandeError) throw demandeError;

        let pdfBytes;
        let docName;

        const { data: companySettings } = await supabase.from('company_settings').select('*').limit(1).single();
        if (!companySettings) throw new Error('Company settings not found');

        if (demande.type === 'COMMANDE_MENU') {
            const formulaPrices = {
                "Formule Découverte (39€)": 39, "Formule Standard (49€)": 49,
                "Formule Confort (59€)": 59, "Option Duo (94€)": 94
            };
            const formulaName = demande.details_json.formulaName;
            const price = formulaPrices[formulaName] || 0;
            
            const simpleInvoiceData = { 
                document_number: `FCM-${demandeId.substring(0,4)}`, 
                created_at: demande.created_at, 
                total_amount: price, 
                items: [{name: formulaName, quantity: 1, unit_price: price}],
                clients: demande.clients,
                entreprises: demande.entreprises
            };
            pdfBytes = await generateProfessionalInvoicePDF(simpleInvoiceData, companySettings, 'Facture');
            docName = simpleInvoiceData.document_number;
        } else {
            const { data: quote } = await supabase.from('quotes').select('id').eq('demande_id', demande.id).maybeSingle();
            if (!quote) throw new Error('No quote found for this demande');

            const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('*, clients(*), entreprises(*)').eq('quote_id', quote.id).single();
            if (invoiceError) throw invoiceError;

            pdfBytes = await generateProfessionalInvoicePDF(invoice, companySettings, documentType);
            docName = invoice.document_number;
        }
        
        if (sendEmail) {
            // ... (email logic remains the same)
        }

        let response = new Response(pdfBytes, {
            status: 200,
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docName}.pdf"` }
        });
        return addCorsHeaders(response);

    } catch (error) {
        console.error('[ERREUR] generate-document:', error.message);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}
