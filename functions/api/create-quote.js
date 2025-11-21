import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

// --- CORS Headers ---
const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Allow all origins, you can restrict this in production
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
};


// --- Main Function Handler ---
export async function onRequest(context) {
    console.log('--- [DEBUG] create-quote function called ---');

    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        console.log('--- [DEBUG] create-quote: Authenticating request...');
        // --- Authentication (Example: checking for a simple password or token) ---
        // IMPORTANT: Replace with your actual authentication logic (e.g., JWT verification)
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${context.env.ADMIN_PASSWORD}`) {
            console.error('--- [ERROR] create-quote: Authentication failed.');
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
        }
        console.log('--- [DEBUG] create-quote: Authentication successful.');


        const { customer, items, total, type } = await context.request.json();
        console.log('--- [DEBUG] create-quote: Received data:', { customer, items, total, type });


        if (!customer || !customer.id || !items || items.length === 0 || !total || !type) {
            console.error('--- [ERROR] create-quote: Missing required fields.');
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        console.log('--- [DEBUG] create-quote: Supabase client created.');

        // 1. Insert the quote to get its ID
        const { data: quoteData, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                client_id: customer.id,
                total_amount: total,
                status: 'draft',
                type: type,
            })
            .select()
            .single();

        if (quoteError) throw quoteError;
        console.log('--- [DEBUG] create-quote: Quote inserted, ID:', quoteData.id);


        // 2. Insert quote items
        const quoteItems = items.map(item => ({
            quote_id: quoteData.id,
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.price,
        }));

        const { error: itemsError } = await supabase.from('quote_items').insert(quoteItems);
        if (itemsError) throw itemsError;
        console.log('--- [DEBUG] create-quote: Quote items inserted.');

        
        // 3. Generate PDF
        console.log('--- [DEBUG] create-quote: Generating PDF...');
        const pdfBytes = await generateQuotePDF(quoteData, customer, items, total);
        console.log('--- [DEBUG] create-quote: PDF generated.');

        // 4. (Optional) Send email with Resend
        // ... (email sending logic can be added here) ...


        return addCorsHeaders(new Response(pdfBytes, {
            status: 200,
            headers: { 
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="devis-${quoteData.id}.pdf"`
            },
        }));

    } catch (error) {
        console.error('--- [ERROR] create-quote: Caught exception:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}


// --- PDF Generation Helper ---
async function generateQuotePDF(quote, customer, items, total) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;

    // Header
    page.drawText('DEVIS', { x: 50, y, font: boldFont, size: 24 });
    y -= 30;
    page.drawText(`Devis #${quote.id}`, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(`Date: ${new Date(quote.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 12 });

    // Customer Info
    y -= 40;
    page.drawText('Client:', { x: 50, y, font: boldFont, size: 14 });
    y -= 20;
    page.drawText(customer.last_name, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(customer.email, { x: 50, y, font, size: 12 });
    if (customer.phone) {
        y -= 15;
        page.drawText(customer.phone, { x: 50, y, font, size: 12 });
    }
    
    // Items Table
    y -= 50;
    page.drawText('Description', { x: 50, y, font: boldFont, size: 12 });
    page.drawText('Qté', { x: 350, y, font: boldFont, size: 12 });
    page.drawText('P.U.', { x: 400, y, font: boldFont, size: 12 });
    page.drawText('Total', { x: 480, y, font: boldFont, size: 12 });
    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;

    items.forEach(item => {
        page.drawText(item.description, { x: 50, y, font, size: 10 });
        page.drawText(item.quantity.toString(), { x: 350, y, font, size: 10 });
        page.drawText(`${item.price.toFixed(2)} €`, { x: 400, y, font, size: 10 });
        page.drawText(`${(item.price * item.quantity).toFixed(2)} €`, { x: 480, y, font, size: 10 });
        y -= 20;
    });

    // Total
    y -= 10;
    page.drawLine({ start: { x: 350, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;
    page.drawText('Total HT:', { x: 350, y, font: boldFont, size: 14 });
    page.drawText(`${total.toFixed(2)} €`, { x: 480, y, font: boldFont, size: 14 });
    
    // Footer
    page.drawText('Merci pour votre confiance.', { x: 50, y: 50, font, size: 10 });

    return pdfDoc.save();
}