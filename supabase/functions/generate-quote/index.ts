import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { format } from "https://deno.land/std@0.168.0/datetime/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "X-Document-Number",
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

    // --- Récupérer les informations de l'entreprise ---
    const { data: companySettingsArray, error: companyError } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1);

    if (companyError) {
        throw new Error(`Erreur récupération infos entreprise: ${companyError.message}`);
    }
    if (!companySettingsArray || companySettingsArray.length === 0) {
        throw new Error('Informations entreprise non trouvées dans la base de données. Veuillez créer une entrée dans la table company_settings.');
    }
    const companySettings = companySettingsArray[0];


    const { customer, items, total, type } = await req.json();

    // --- 1. Générer le numéro de document ---
    console.log("--- DOCUMENT NUMBER DEBUGGING ---");
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
    
    console.log(`Year: ${year}`);
    console.log(`Month: ${month}`);
    console.log(`Week: ${week}`);
    console.log(`Day of Week: ${dayOfWeek}`);
    console.log(`Padded Order Number: ${paddedOrderNumber}`);
    console.log(`Random Code: ${randomCode}`);

    const documentNumber = `DR_${year}_${month}_${week}_${dayOfWeek}_${paddedOrderNumber}_${randomCode}`;
    console.log(`Final Document Number: ${documentNumber}`);
    console.log("--- END DEBUGGING ---");

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
    const pdfBytes = await generatePDF(newQuote, customer, items, total, companySettings);

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
        pdfBytes,
        companySettings
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

// =============================================
// GÉNÉRATION DU PDF
// =============================================
async function generatePDF(
  quote: any,
  customer: any,
  items: any[],
  total: number,
  companySettings: any
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const gold = rgb(0.83, 0.69, 0.22);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.95, 0.95, 0.95);
  const white = rgb(1, 1, 1);

  let y = height - 50;
  let textStartX = 50;

  // ============================================
  // LOGO + EN-TÊTE
  // ============================================
  try {
    if (companySettings.logo_url) {
      const logoResponse = await fetch(companySettings.logo_url);
      const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
      
      const logoImage = companySettings.logo_url.toLowerCase().includes('.png')
        ? await pdfDoc.embedPng(logoBytes)
        : await pdfDoc.embedJpg(logoBytes);

      const logoHeight = 65;
      const logoDims = logoImage.scale(logoHeight / logoImage.height);

      page.drawImage(logoImage, {
        x: 50,
        y: y - logoDims.height + 20,
        width: logoDims.width,
        height: logoDims.height,
      });

      textStartX = 50 + logoDims.width + 15;
    }
  } catch (e) {
    console.error("Logo non chargé:", e);
  }

  // Nom entreprise
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

  // Badge DEVIS (droite)
  page.drawRectangle({ x: 460, y: height - 58, width: 90, height: 35, color: gold });
  page.drawText("DEVIS", { x: 472, y: height - 48, size: 18, font: fontBold, color: white });

  // Infos devis (droite)
  let yRight = height - 95;
  page.drawText(`N°: ${quote.document_number || ''}`, { x: 460, y: yRight, size: 10, font: fontBold, color: black });
  yRight -= 14;
  page.drawText(`Date: ${new Date(quote.created_at).toLocaleDateString("fr-FR")}`, { x: 460, y: yRight, size: 9, font, color: gray });
  yRight -= 14;
  page.drawText("Validité: 30 jours", { x: 460, y: yRight, size: 9, font, color: gray });

  // ============================================
  // LIGNE DE SÉPARATION
  // ============================================
  y -= 25;
  page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 2, color: gold });

  // ============================================
  // BLOC CLIENT (droite)
  // ============================================
  y -= 30;
  page.drawRectangle({ x: 320, y: y - 55, width: 225, height: 75, color: lightGray });

  page.drawText("DESTINATAIRE", { x: 330, y: y - 5, size: 10, font: fontBold, color: gold });

  const customerName = customer.type === "client"
    ? `${customer.first_name || ""} ${customer.last_name || ''}`.trim()
    : (customer.nom_entreprise || '');
  page.drawText(customerName, { x: 330, y: y - 22, size: 11, font: fontBold, color: black });

  if (customer.address) {
    page.drawText(customer.address || '', { x: 330, y: y - 37, size: 9, font, color: gray });
  }

  const customerEmail = customer.email || customer.contact_email;
  if (customerEmail) {
    page.drawText(customerEmail || '', { x: 330, y: y - 50, size: 9, font, color: gray });
  }

  // ============================================
  // TABLEAU DES SERVICES
  // ============================================
  y -= 95;

  // En-tête tableau
  page.drawRectangle({ x: 50, y: y - 8, width: 495, height: 28, color: gold });
  page.drawText("Description", { x: 60, y, size: 10, font: fontBold, color: white });
  page.drawText("Qté", { x: 340, y, size: 10, font: fontBold, color: white });
  page.drawText("Prix unit.", { x: 400, y, size: 10, font: fontBold, color: white });
  page.drawText("Total", { x: 490, y, size: 10, font: fontBold, color: white });

  y -= 35;

  // Lignes du tableau
  let rowIndex = 0;
  for (const item of items) {
    if (rowIndex % 2 === 0) {
      page.drawRectangle({ x: 50, y: y - 8, width: 495, height: 25, color: lightGray });
    }

    const desc = (item.description || item.name || "Service").substring(0, 45);
    page.drawText(desc, { x: 60, y, size: 10, font, color: black });
    page.drawText(String(item.quantity || 0), { x: 350, y, size: 10, font, color: black });
    page.drawText(`${(item.price || 0).toFixed(2)} €`, { x: 400, y, size: 10, font, color: black });
    page.drawText(`${((item.price || 0) * (item.quantity || 0)).toFixed(2)} €`, { x: 485, y, size: 10, font, color: black });

    y -= 25;
    rowIndex++;
    if (y < 200) break;
  }

  // ============================================
  // BLOC TOTAL
  // ============================================
  y -= 15;
  page.drawRectangle({ x: 350, y: y - 35, width: 195, height: 50, color: rgb(0.98, 0.98, 0.98), borderColor: gold, borderWidth: 2 });
  page.drawText("TOTAL TTC:", { x: 365, y: y - 15, size: 12, font: fontBold, color: black });
  page.drawText(`${(total || 0).toFixed(2)} €`, { x: 470, y: y - 15, size: 14, font: fontBold, color: gold });

  // Mention TVA
  page.drawText(companySettings.tva_message || '', { x: 50, y: y - 25, size: 8, font, color: gray });

  // ============================================
  // ZONE SIGNATURE
  // ============================================
  y -= 80;
  page.drawText("Bon pour accord", { x: 50, y, size: 10, font: fontBold, color: black });
  page.drawText("Date et signature du client :", { x: 50, y: y - 15, size: 9, font, color: gray });
  page.drawRectangle({ x: 50, y: y - 75, width: 200, height: 55, borderColor: gray, borderWidth: 1 });

  // Conditions de paiement
  page.drawText("Conditions : Paiement à réception", { x: 300, y: y - 15, size: 9, font, color: gray });
  page.drawText("Moyens : Virement, Espèces, CB", { x: 300, y: y - 28, size: 9, font, color: gray });

  // ============================================
  // PIED DE PAGE
  // ============================================
  page.drawLine({ start: { x: 50, y: 45 }, end: { x: 545, y: 45 }, thickness: 1, color: gold });
  page.drawText(`${companySettings.name || ''} | ${companySettings.owner || ''} | SIRET: ${companySettings.siret || ''} | ${companySettings.website || ''}`, {
    x: 95, y: 30, size: 8, font, color: gray,
  });
  page.drawText("Merci de votre confiance !", { x: 240, y: 18, size: 8, font: fontBold, color: gold });

  return await pdfDoc.save();
}

// --- Envoi email via Resend ---
async function sendEmailWithResend(apiKey: string, toEmail: string, customerName: string, documentNumber: string, pdfBytes: Uint8Array, companySettings: any): Promise<void> {
  const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${companySettings.name || 'Asiacuisine.re'} <devis@asiacuisine.re>`,
      to: [toEmail],
      subject: `Votre devis ${companySettings.name || 'Asiacuisine.re'} - ${documentNumber}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            ${companySettings.logo_url ? `<img src="${companySettings.logo_url}" alt="${companySettings.name}" style="max-height: 80px;" />` : ''}
          </div>
          <h2 style="color: #d4af37; margin-bottom: 20px;">Votre Devis</h2>
          <p>Bonjour ${customerName},</p>
          <p>Nous vous remercions pour votre intérêt envers nos services.</p>
          <p>Veuillez trouver ci-joint votre devis N° <strong>${documentNumber}</strong>.</p>
          <p>Ce devis est valable <strong>30 jours</strong> à compter de sa date d'émission.</p>
          <p>N'hésitez pas à nous contacter pour toute question ou pour confirmer votre réservation.</p>
          <br/>
          <p>Cordialement,</p>
          <p><strong>L'équipe ${companySettings.name || 'Asiacuisine.re'}</strong></p>
          <hr style="border: none; border-top: 2px solid #d4af37; margin: 30px 0;" />
          <p style="font-size: 12px; color: #666;">
            ${companySettings.address || ''}, ${companySettings.city || ''}<br/>
            Tél: ${companySettings.phone || ''} | ${companySettings.email || ''}<br/>
            ${companySettings.website || ''}
          </p>
        </div>
      `,
      attachments: [{ filename: `devis-${documentNumber}.pdf`, content: pdfBase64 }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("Resend error:", errorData);
    throw new Error(`Erreur envoi email: ${errorData.message}`);
  }
}