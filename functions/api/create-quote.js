import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

async function generateQuotePdf(quote, customer, items) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    // Header
    page.drawText('Devis Asiacuisine.re', { x: 50, y, font: boldFont, size: 24, color: rgb(0.83, 0.68, 0.21) });
    y -= 30;

    // Quote Info
    page.drawText(`Devis #: ${quote.id.substring(0, 8)}`, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(`Date: ${new Date(quote.quote_date).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 12 });
    y -= 30;

    // Customer Info
    page.drawText('Client:', { x: 50, y, font: boldFont, size: 14 });
    y -= 20;
    if (customer.type === 'client') {
        page.drawText(`${customer.first_name} ${customer.last_name}`, { x: 50, y, font, size: 12 });
        y -= 15;
        page.drawText(customer.email, { x: 50, y, font, size: 12 });
    } else {
        page.drawText(customer.nom_entreprise, { x: 50, y, font, size: 12 });
        y -= 15;
        page.drawText(`Contact: ${customer.contact_name}`, { x: 50, y, font, size: 12 });
        y -= 15;
        page.drawText(customer.contact_email, { x: 50, y, font, size: 12 });
    }
    y -= 30;

    // Table Header
    page.drawText('Service', { x: 50, y, font: boldFont, size: 12 });
    page.drawText('Qté', { x: 300, y, font: boldFont, size: 12 });
    page.drawText('Prix U.', { x: 350, y, font: boldFont, size: 12 });
    page.drawText('Total', { x: 450, y, font: boldFont, size: 12 });
    y -= 20;

    // Table Items
    items.forEach(item => {
        page.drawText(item.name, { x: 50, y, font, size: 12 });
        page.drawText(item.quantity.toString(), { x: 300, y, font, size: 12 });
        page.drawText(`${item.unit_price.toFixed(2)} €`, { x: 350, y, font, size: 12 });
        page.drawText(`${(item.quantity * item.unit_price).toFixed(2)} €`, { x: 450, y, font, size: 12 });
        y -= 20;
    });

    // Total
    y -= 10;
    page.drawText('Total du devis:', { x: 350, y, font: boldFont, size: 14 });
    page.drawText(`${quote.total_amount.toFixed(2)} €`, { x: 450, y, font: boldFont, size: 14 });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        const { customer, items, total } = await context.request.json();
        if (!customer || !items || !total) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing required fields (customer, items, total)' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Create the quote
        const quotePayload = {
            client_id: customer.type === 'client' ? customer.id : null,
            entreprise_id: customer.type === 'entreprise' ? customer.id : null,
            total_amount: total,
            status: 'sent',
        };

        const { data: newQuote, error: quoteError } = await supabase
            .from('quotes')
            .insert(quotePayload)
            .select()
            .single();

        if (quoteError) throw quoteError;

        // 2. Create the quote items
        const quoteItemsPayload = items.map(item => ({
            quote_id: newQuote.id,
            service_id: item.service_id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.price,
        }));

        const { error: itemsError } = await supabase
            .from('quote_items')
            .insert(quoteItemsPayload);

        if (itemsError) throw itemsError;

        // 3. Generate the PDF
        const pdfBytes = await generateQuotePdf(newQuote, customer, quoteItemsPayload);

        // 4. Send email with PDF attachment
        const resend = new Resend(context.env.RESEND_API_KEY);
        const recipientEmail = customer.type === 'client' ? customer.email : customer.contact_email;
        const recipientName = customer.type === 'client' ? `${customer.first_name} ${customer.last_name}` : customer.contact_name;

        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: recipientEmail,
            subject: 'Votre devis Asiacuisine.re',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h1>Bonjour ${recipientName},</h1>
                    <p>Veuillez trouver ci-joint votre devis pour les services demandés.</p>
                    <p>Nous restons à votre disposition pour toute question.</p>
                    <p>Cordialement,</p>
                    <p>L'équipe Asiacuisine.re</p>
                </div>
            `,
            attachments: [{
                filename: `devis_${newQuote.id.substring(0, 8)}.pdf`,
                content: Buffer.from(pdfBytes),
            }],
        });

        return addCorsHeaders(new Response(JSON.stringify({ success: true, quoteId: newQuote.id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans create-quote ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}
