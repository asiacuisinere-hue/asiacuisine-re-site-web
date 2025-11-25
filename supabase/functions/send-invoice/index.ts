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

    page.drawText('FACTURE', { x: 50, y, font: boldFont, size: 24 });
    y -= 30;
    page.drawText(`Facture #${invoice.id.substring(0, 8)}`, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(`Date: ${new Date(invoice.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 12 });

    const customer = invoice.clients || invoice.entreprises;
    y -= 40;
    page.drawText('Client:', { x: 50, y, font: boldFont, size: 14 });
    y -= 20;
    page.drawText(customer.last_name ? `${customer.first_name} ${customer.last_name}` : customer.nom_entreprise, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(customer.email || customer.contact_email, { x: 50, y, font, size: 12 });
    
    y -= 50;
    page.drawText('Description', { x: 50, y, font: boldFont, size: 12 });
    page.drawText('Qté', { x: 350, y, font: boldFont, size: 12 });
    page.drawText('P.U.', { x: 400, y, font: boldFont, size: 12 });
    page.drawText('Total', { x: 480, y, font: boldFont, size: 12 });
    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;

    invoice.items.forEach((item: any) => {
        page.drawText(item.name || item.description, { x: 50, y, font, size: 10 });
        page.drawText(item.quantity.toString(), { x: 350, y, font, size: 10 });
        page.drawText(`${item.price.toFixed(2)} €`, { x: 400, y, font, size: 10 });
        page.drawText(`${(item.quantity * item.price).toFixed(2)} €`, { x: 480, y, font, size: 10 });
        y -= 20;
    });

    y -= 10;
    page.drawLine({ start: { x: 350, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;
    page.drawText('Total HT:', { x: 350, y, font: boldFont, size: 14 });
    page.drawText(`${invoice.total_amount.toFixed(2)} €`, { x: 480, y, font: boldFont, size: 14 });
    
    page.drawText('Merci pour votre confiance.', { x: 50, y: 50, font, size: 10 });

    return await pdfDoc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId } = await req.json();
    if (!invoiceId) throw new Error("ID de facture manquant.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`*, items, clients (*), entreprises (*)`)
      .eq("id", invoiceId)
      .single();

    if (error) throw error;

    const pdfBytes = await generateInvoicePDF(invoice);

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const customerEmail = invoice.clients?.email || invoice.entreprises?.contact_email;

    if (!customerEmail) throw new Error("Email du client non trouvé.");

    await resend.emails.send({
      from: "facturation@asiacuisine.re",
      to: customerEmail,
      bcc: "contact@asiacuisine.re",
      subject: `Votre facture Asiacuisine.re #${invoice.id.substring(0, 8)}`,
      html: `<p>Bonjour,</p><p>Veuillez trouver ci-joint votre facture pour les services Asiacuisine.re.</p><p>Merci pour votre confiance.</p>`,
      attachments: [{
        filename: `facture-${invoice.id.substring(0, 8)}.pdf`,
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
