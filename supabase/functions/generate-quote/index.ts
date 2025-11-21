import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Helper Functions ---

// Calcule le numéro de semaine ISO
function getWeekNumber(d: Date): number {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

// Génère une chaîne alphanumérique aléatoire
function randomString(length: number): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { customer, items, total, type } = await req.json();

    // --- 1. Générer le numéro de document ---
    const now = new Date();
    const year = format(now, "yyyy");
    const month = format(now, "MM");
    const week = getWeekNumber(now);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Lundi=1, Dimanche=7
    
    // Compter les devis du jour pour le numéro d'ordre
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { count, error: countError } = await supabase
      .from("quotes")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString());

    if (countError) {
      throw new Error(`Erreur comptage devis: ${countError.message}`);
    }

    const orderNumber = (count || 0) + 1;
    const paddedOrderNumber = String(orderNumber).padStart(4, "0");
    const randomCode = randomString(6);
    
    const documentNumber = `DR_${year}_${month}_${week}_${dayOfWeek}_${paddedOrderNumber}_${randomCode}`;

    // --- 2. Sauvegarder le devis ---
    const quoteData = {
      client_id: customer.type === "client" ? customer.id : null,
      entreprise_id: customer.type === "entreprise" ? customer.id : null,
      total_amount: total,
      status: "sent",
      type: type || "service_reservation",
      document_number: documentNumber, // Ajout du nouveau numéro
      created_at: now.toISOString(),
    };

    const { data: newQuote, error: quoteError } = await supabase
      .from("quotes")
      .insert([quoteData])
      .select()
      .single();

    if (quoteError) {
      throw new Error(`Erreur sauvegarde devis: ${quoteError.message}`);
    }

    // --- 3. Sauvegarder les lignes du devis ---
    const itemsToInsert = items.map((item: any) => ({
      quote_id: newQuote.id,
      service_id: item.service_id,
      name: item.name || "Service",
      description: item.description,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("quote_items")
      .insert(itemsToInsert);

    if (itemsError) {
      throw new Error(`Erreur sauvegarde lignes: ${itemsError.message}`);
    }

    // --- 4. Générer le PDF ---
    const pdfBytes = await generatePDF(newQuote, customer, items, total);

    // --- 5. Envoyer l'email via Resend ---
    const customerEmail = customer.type === "client" 
      ? customer.email 
      : customer.contact_email;
    
    const customerName = customer.type === "client"
      ? `${customer.first_name || ""} ${customer.last_name}`.trim()
      : customer.nom_entreprise;

    if (customerEmail) {
      await sendEmailWithResend(
        resendApiKey,
        customerEmail,
        customerName,
        documentNumber,
        pdfBytes
      );
    }

    // --- 6. Retourner le PDF ---
    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="devis-${documentNumber}.pdf"`,
        "X-Document-Number": documentNumber,
      },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// --- Génération du PDF ---
async function generatePDF(
  quote: any,
  customer: any,
  items: any[],
  total: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { height } = page.getSize();
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const gold = rgb(0.83, 0.69, 0.22);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  let y = height - 50;

  // --- En-tête ---
  page.drawText("ASIA CUISINE", { x: 50, y, size: 24, font: fontBold, color: gold });
  y -= 30;
  page.drawText("Devis", { x: 50, y, size: 18, font: fontBold, color: black });

  // --- Infos devis ---
  y -= 40;
  page.drawText(`Devis N°: ${quote.document_number}`, { x: 50, y, size: 10, font, color: gray });
  y -= 15;
  page.drawText(`Date: ${new Date(quote.created_at).toLocaleDateString("fr-FR")}`, { x: 50, y, size: 10, font, color: gray });

  // --- Infos client ---
  y -= 40;
  page.drawText("Client:", { x: 50, y, size: 12, font: fontBold, color: black });
  y -= 18;
  const customerName = customer.type === "client" ? `${customer.first_name || ""} ${customer.last_name}`.trim() : customer.nom_entreprise;
  page.drawText(customerName, { x: 50, y, size: 10, font, color: black });
  if (customer.email || customer.contact_email) {
    y -= 15;
    page.drawText(customer.email || customer.contact_email, { x: 50, y, size: 10, font, color: gray });
  }

  // --- Tableau des services ---
  y -= 50;
  page.drawRectangle({ x: 50, y: y - 5, width: 495, height: 25, color: rgb(0.96, 0.96, 0.96) });
  page.drawText("Description", { x: 55, y, size: 10, font: fontBold, color: black });
  page.drawText("Qté", { x: 320, y, size: 10, font: fontBold, color: black });
  page.drawText("Prix unit.", { x: 380, y, size: 10, font: fontBold, color: black });
  page.drawText("Total", { x: 480, y, size: 10, font: fontBold, color: black });
  y -= 30;

  for (const item of items) {
    const description = item.description || item.name || "Service";
    const truncatedDesc = description.length > 40 ? description.substring(0, 40) + "..." : description;
    page.drawText(truncatedDesc, { x: 55, y, size: 9, font, color: black });
    page.drawText(String(item.quantity), { x: 325, y, size: 9, font, color: black });
    page.drawText(`${item.price.toFixed(2)} €`, { x: 380, y, size: 9, font, color: black });
    page.drawText(`${(item.price * item.quantity).toFixed(2)} €`, { x: 480, y, size: 9, font, color: black });
    y -= 20;
    if (y < 100) break;
  }

  // --- Total ---
  y -= 20;
  page.drawLine({ start: { x: 350, y: y + 15 }, end: { x: 545, y: y + 15 }, thickness: 1, color: gray });
  page.drawText("TOTAL TTC:", { x: 380, y, size: 12, font: fontBold, color: black });
  page.drawText(`${total.toFixed(2)} €`, { x: 480, y, size: 12, font: fontBold, color: gold });

  // --- Footer ---
  page.drawText("Devis valable 30 jours. Merci de votre confiance.", { x: 50, y: 50, size: 9, font, color: gray });

  return await pdfDoc.save();
}

// --- Envoi email via Resend ---
async function sendEmailWithResend(
  apiKey: string,
  toEmail: string,
  customerName: string,
  documentNumber: string,
  pdfBytes: Uint8Array
): Promise<void> {
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Asia Cuisine <devis@asiacuisine.re>",
      to: [toEmail],
      subject: `Votre devis Asia Cuisine - ${documentNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #d4af37;">Asia Cuisine</h1>
          <p>Bonjour ${customerName},</p>
          <p>Veuillez trouver ci-joint votre devis N° <strong>${documentNumber}</strong>.</p>
          <p>Ce devis est valable 30 jours à compter de sa date d'émission.</p>
          <p>N'hésitez pas à nous contacter pour toute question.</p>
          <br/>
          <p>Cordialement,</p>
          <p><strong>L'équipe Asia Cuisine</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `devis-${documentNumber}.pdf`,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Resend error:", errorData);
    throw new Error(`Erreur envoi email: ${errorData.message}`);
  }
}