import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

// --- CORS Headers Helper ---
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };
}

// --- Handle OPTIONS (CORS Preflight) ---
export async function onRequestOptions() {
    console.log('--- [DEBUG] create-quote: OPTIONS request received');
    return new Response(null, {
        status: 204,
        headers: corsHeaders()
    });
}

// --- Handle POST Requests ---
export async function onRequestPost(context) {
    console.log('--- [DEBUG] create-quote: POST request received');

    try {
        // --- Authentication ---
        console.log('--- [DEBUG] create-quote: Authenticating request...');
        const authHeader = context.request.headers.get('Authorization');
        
        if (!authHeader) {
            console.error('--- [ERROR] create-quote: No Authorization header');
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 401,
                headers: corsHeaders()
            });
        }

        if (authHeader !== `Bearer ${context.env.ADMIN_PASSWORD}`) {
            console.error('--- [ERROR] create-quote: Invalid credentials');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: corsHeaders()
            });
        }
        
        console.log('--- [DEBUG] create-quote: Authentication successful');

        // --- Parse Request Body ---
        let body;
        try {
            body = await context.request.json();
        } catch (e) {
            console.error('--- [ERROR] create-quote: Invalid JSON in request body');
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                status: 400,
                headers: corsHeaders()
            });
        }

        const { customer, items, total, type } = body;
        console.log('--- [DEBUG] create-quote: Received data:', { customer, items, total, type });

        // --- Validate Required Fields ---
        if (!customer || !customer.id || !items || items.length === 0 || !total || !type) {
            console.error('--- [ERROR] create-quote: Missing required fields');
            return new Response(JSON.stringify({ 
                error: 'Missing required fields',
                required: ['customer.id', 'items', 'total', 'type']
            }), {
                status: 400,
                headers: corsHeaders()
            });
        }

        // --- Initialize Supabase ---
        const supabase = createClient(
            context.env.SUPABASE_URL, 
            context.env.SUPABASE_SERVICE_ROLE_KEY
        );
        console.log('--- [DEBUG] create-quote: Supabase client created');

        // --- 1. Insert Quote ---
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

        if (quoteError) {
            console.error('--- [ERROR] create-quote: Failed to insert quote:', quoteError);
            throw quoteError;
        }
        
        console.log('--- [DEBUG] create-quote: Quote inserted, ID:', quoteData.id);

        // --- 2. Insert Quote Items ---
        const quoteItems = items.map(item => ({
            quote_id: quoteData.id,
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.price,
        }));

        const { error: itemsError } = await supabase
            .from('quote_items')
            .insert(quoteItems);
            
        if (itemsError) {
            console.error('--- [ERROR] create-quote: Failed to insert items:', itemsError);
            throw itemsError;
        }
        
        console.log('--- [DEBUG] create-quote: Quote items inserted');

        // --- 3. Generate PDF ---
        console.log('--- [DEBUG] create-quote: Generating PDF...');
        const pdfBytes = await generateQuotePDF(quoteData, customer, items, total);
        console.log('--- [DEBUG] create-quote: PDF generated successfully');

        // --- Return PDF ---
        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="devis-${quoteData.id}.pdf"`,
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('--- [ERROR] create-quote: Caught exception:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal Server Error', 
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: corsHeaders()
        });
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
    page.drawText(customer.last_name || 'N/A', { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(customer.email || 'N/A', { x: 50, y, font, size: 12 });
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
        page.drawText(item.description || '', { x: 50, y, font, size: 10 });
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