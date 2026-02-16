import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function generateInvoicePDF(invoice: any) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;

    // === EN-TÊTE ===
    page.drawText('FACTURE', { x: 50, y, font: boldFont, size: 24 });
    y -= 30;
    page.drawText(`Document N°: ${invoice.document_number || invoice.id.substring(0, 8)}`, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(`Date: ${new Date(invoice.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 12 });

    const customer = invoice.clients || invoice.entreprises;
    y -= 40;
    page.drawText('Destinataire:', { x: 50, y, font: boldFont, size: 14 });
    y -= 20;
    page.drawText(customer.last_name ? `${customer.first_name} ${customer.last_name}` : (customer.nom_entreprise || 'Client'), { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(customer.email || customer.contact_email, { x: 50, y, font, size: 12 });
    
    // === TABLEAU ===
    y -= 50;
    page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 25, color: rgb(0.95, 0.95, 0.95) });
    page.drawText('Désignation', { x: 60, y, font: boldFont, size: 10 });
    page.drawText('Qté', { x: 350, y, font: boldFont, size: 10 });
    page.drawText('P.U.', { x: 400, y, font: boldFont, size: 10 });
    page.drawText('Total HT', { x: 480, y, font: boldFont, size: 10 });
    y -= 30;

    invoice.items.forEach((item: any) => {
        page.drawText((item.name || item.description).substring(0, 45), { x: 60, y, font, size: 10 });
        page.drawText(String(item.quantity || 1), { x: 350, y, font, size: 10 });
        page.drawText(`${(item.unit_price || item.price || 0).toFixed(2)} €`, { x: 400, y, font, size: 10 });
        page.drawText(`${((item.quantity || 1) * (item.unit_price || item.price || 0)).toFixed(2)} €`, { x: 480, y, font, size: 10 });
        y -= 20;
    });

    // === RÉCAPITULATIF FINANCIER ===
    y -= 30;
    page.drawLine({ start: { x: 300, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 25;
    
    // Total Général
    page.drawText('TOTAL PRESTATION:', { x: 300, y, font: boldFont, size: 12 });
    page.drawText(`${invoice.total_amount.toFixed(2)} €`, { x: 480, y, font: boldFont, size: 12 });
    y -= 20;

    // Gestion de l'acompte (Si payé ou en cours)
    if (invoice.status === 'deposit_paid' || invoice.deposit_amount > 0) {
        page.drawText('ACOMPTE DÉJÀ RÉGLÉ:', { x: 300, y, font, size: 11, color: rgb(0.15, 0.68, 0.37) });
        page.drawText(`- ${invoice.deposit_amount.toFixed(2)} €`, { x: 480, y, font, size: 11, color: rgb(0.15, 0.68, 0.37) });
        y -= 25;
        
        page.drawRectangle({ x: 300, y: y - 10, width: 245, height: 30, color: rgb(0.98, 0.95, 0.9) });
        page.drawText('NET À PAYER (SOLDE):', { x: 310, y, font: boldFont, size: 13 });
        const balance = invoice.total_amount - invoice.deposit_amount;
        page.drawText(`${balance.toFixed(2)} €`, { x: 480, y, font: boldFont, size: 13 });
    } else {
        // Si acompte non encore payé, on affiche juste le net à payer égal au total
        page.drawText('NET À PAYER:', { x: 300, y, font: boldFont, size: 13 });
        page.drawText(`${invoice.total_amount.toFixed(2)} €`, { x: 480, y, font: boldFont, size: 13 });
    }
    
    y = 80;
    page.drawText('Merci pour votre confiance.', { x: 50, y, font, size: 10 });
    y -= 15;
    page.drawText('TVA non applicable, art. 293 B du CGI', { x: 50, y, font, size: 8, color: rgb(0.5, 0.5, 0.5) });

    return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { invoiceId } = await req.json();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`*, clients (*), entreprises (*)`)
      .eq("id", invoiceId)
      .single();

    if (error) throw error;

    const pdfBytes = await generateInvoicePDF(invoice);
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const customerEmail = invoice.clients?.email || invoice.entreprises?.contact_email;

    if (!customerEmail) throw new Error("Email du client non trouvé.");

    // Adapter le sujet selon le statut
    const subject = invoice.status === 'deposit_paid' ? 
        `Mise à jour Facture - Solde restant - Asiacuisine.re #${invoice.document_number || invoice.id.substring(0, 8)}` :
        `Votre facture Asiacuisine.re #${invoice.document_number || invoice.id.substring(0, 8)}`;

    await resend.emails.send({
      from: "Asiacuisine.re <facturation@asiacuisine.re>",
      to: customerEmail,
      bcc: "contact@asiacuisine.re",
      subject: subject,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
            <h2>Votre facture à jour</h2>
            <p>Bonjour,</p>
            <p>Veuillez trouver ci-joint votre facture actualisée.</p>
            ${invoice.status === 'deposit_paid' ? 
                `<p style="color: #28a745; font-weight: bold;">✅ Votre acompte a bien été reçu. Ce document récapitule le solde restant à régler.</p>` : 
                `<p>Ce document récapitule les détails de votre réservation.</p>`}
            <p>Merci pour votre confiance.</p>
            <br>
            <p><strong>L'équipe Asiacuisine.re</strong></p>
        </div>
      `,
      attachments: [{
        filename: `facture-${invoice.document_number || invoice.id.substring(0, 8)}.pdf`,
        content: pdfBytes,
      }],
    });

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
