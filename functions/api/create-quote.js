import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// --- HELPER FUNCTIONS ---

const addCorsHeaders = (response, origin) => {
    const allowedOrigins = ['https://www.asiacuisine.re', 'https://gestion.asiacuisine.re'];
    if (allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
        response.headers.set('Access-Control-Allow-Origin', 'https://www.asiacuisine.re');
    }
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

// Obtenir le numéro de semaine (ISO 8601)
const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
};

// Générer un code alphanumérique aléatoire
const generateRandomCode = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Générer le nom de fichier
const generateFilename = (prefix, quoteNumber) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const week = String(getWeekNumber(now)).padStart(2, '0');
    const dayOfWeek = now.getDay(); // 0=Dimanche, 1=Lundi...
    const position = String(quoteNumber).padStart(4, '0');
    const randomCode = generateRandomCode(6);

    return `${prefix}_${year}_${month}_${week}_${dayOfWeek}_${position}_${randomCode}.pdf`;
};


async function generateQuotePdf(quote, customer, items, filename) {
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
    page.drawText(`Devis: ${filename.replace('.pdf', '')}`, { x: 50, y, font, size: 10 });
    y -= 15;
    page.drawText(`Date: ${new Date(quote.quote_date).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 10 });
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

// --- MAIN FUNCTION ---

export async function onRequest(context) {
    const origin = context.request.headers.get('Origin');

    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }), origin);
    }
    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }), origin);
    }

    try {
        const { customer, items, total, type } = await context.request.json(); // 'type' of quote (commande menu vs service)
        if (!customer || !items || !total || !type) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing required fields (customer, items, total, type)' }), { status: 400 }), origin);
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        
        // 1. Get the current quote count to generate the next number
        const { count, error: countError } = await supabase
            .from('quotes')
            .select('*', { count: 'exact', head: true });

        if (countError) throw countError;
        
        const quoteNumber = count + 1;

        // 2. Determine prefix and generate filename
        const prefix = type === 'commande_menu' ? 'DC' : 'DP';
        const filename = generateFilename(prefix, quoteNumber);

        // 3. Create the quote
        const quotePayload = {
            client_id: customer.type === 'client' ? customer.id : null,
            entreprise_id: customer.type === 'entreprise' ? customer.id : null,
            total_amount: total,
            status: 'sent',
            // Vous pourriez vouloir stocker le nom du fichier ici
            // filename: filename
        };

        const { data: newQuote, error: quoteError } = await supabase
            .from('quotes')
            .insert(quotePayload)
            .select()
            .single();

        if (quoteError) throw quoteError;

        // 4. Create the quote items
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

        // 5. Generate the PDF
        const pdfBytes = await generateQuotePdf(newQuote, customer, quoteItemsPayload, filename);

        // 6. Send email with PDF attachment
        const resend = new Resend(context.env.RESEND_API_KEY);
        const recipientEmail = customer.type === 'client' ? customer.email : customer.contact_email;
        const recipientName = customer.type === 'client' ? `${customer.first_name || ''} ${customer.last_name || ''}`.trim() : customer.contact_name;

        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: recipientEmail,
            subject: 'Votre devis Asiacuisine.re',
            html: `<p>Bonjour ${recipientName},</p><p>Veuillez trouver ci-joint votre devis.</p><p>Cordialement,</p><p>L'équipe Asiacuisine.re</p>`,
            attachments: [{
                filename: filename,
                content: Buffer.from(pdfBytes),
            }],
        });

        // 7. Retourner le nom du fichier et l'URL pour le téléchargement
        // Note: Cette partie est un placeholder. La logique de téléchargement côté client doit être adaptée.
        return addCorsHeaders(new Response(JSON.stringify({ success: true, quoteId: newQuote.id, filename: filename }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }), origin);

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans create-quote ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }), origin);
    }
}
