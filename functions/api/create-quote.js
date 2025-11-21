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
    console.log('[DEBUG-CRASH] STEP 0: Function started.');

    try {
        // --- Authentication ---
        console.log('[DEBUG-CRASH] STEP 1: Authenticating request...');
        const authHeader = context.request.headers.get('Authorization');
        
        if (!authHeader) {
            console.error('[DEBUG-CRASH] ERROR: No Authorization header');
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                status: 401,
                headers: corsHeaders()
            });
        }

        if (authHeader !== `Bearer ${context.env.ADMIN_PASSWORD}`) {
            console.error('[DEBUG-CRASH] ERROR: Invalid credentials');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: corsHeaders()
            });
        }
        
        console.log('[DEBUG-CRASH] STEP 2: Authentication successful.');

        // --- Parse Request Body ---
        let body;
        try {
            console.log('[DEBUG-CRASH] STEP 3: Parsing request body...');
            body = await context.request.json();
            console.log('[DEBUG-CRASH] STEP 4: Body parsed successfully.');
        } catch (e) {
            console.error('[DEBUG-CRASH] ERROR: Invalid JSON in request body', e);
            return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
                status: 400,
                headers: corsHeaders()
            });
        }

        const { customer, items, total, type } = body;
        console.log('[DEBUG-CRASH] STEP 5: Received data:', JSON.stringify({ customer, items, total, type }));

        // --- Validate Required Fields ---
        if (!customer || !customer.id || !items || items.length === 0 || total === undefined || !type) {
            console.error('[DEBUG-CRASH] ERROR: Missing required fields');
            return new Response(JSON.stringify({ 
                error: 'Missing required fields',
                required: ['customer.id', 'items', 'total', 'type']
            }), {
                status: 400,
                headers: corsHeaders()
            });
        }
        console.log('[DEBUG-CRASH] STEP 6: Data validation passed.');

        // --- Initialize Supabase ---
        console.log('[DEBUG-CRASH] STEP 7: Initializing Supabase client...');
        const supabase = createClient(
            context.env.SUPABASE_URL, 
            context.env.SUPABASE_SERVICE_ROLE_KEY
        );
        console.log('[DEBUG-CRASH] STEP 8: Supabase client created.');

        // --- 1. Insert Quote ---
        console.log('[DEBUG-CRASH] STEP 9: Inserting quote into Supabase...');
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
            console.error('[DEBUG-CRASH] ERROR: Failed to insert quote:', quoteError);
            throw quoteError;
        }
        
        console.log('[DEBUG-CRASH] STEP 10: Quote inserted successfully. ID:', quoteData.id);

        // --- 2. Insert Quote Items ---
        const quoteItems = items.map(item => ({
            quote_id: quoteData.id,
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.price,
        }));
        
        console.log('[DEBUG-CRASH] STEP 11: Inserting quote items into Supabase...');
        const { error: itemsError } = await supabase
            .from('quote_items')
            .insert(quoteItems);
            
        if (itemsError) {
            console.error('[DEBUG-CRASH] ERROR: Failed to insert items:', itemsError);
            throw itemsError;
        }
        
        console.log('[DEBUG-CRASH] STEP 12: Quote items inserted successfully.');

        // --- 3. Generate PDF ---
        console.log('[DEBUG-CRASH] STEP 13: Calling generateQuotePDF function...');
        const pdfBytes = await generateQuotePDF(quoteData, customer, items, total);
        console.log('[DEBUG-CRASH] FINAL STEP: PDF generated successfully.');

        // --- Return PDF ---
        console.log('[DEBUG-CRASH] FINAL STEP: Returning PDF response...');
        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="devis-${quoteData.id}.pdf"`,
                'Access-Control-Allow-Origin': '*'
            }
        });

    } catch (error) {
        console.error('[DEBUG-CRASH] FATAL ERROR in catch block:', error);
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
    console.log('[DEBUG-CRASH] PDF_GEN - STEP A: Starting PDF generation.');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    console.log('[DEBUG-CRASH] PDF_GEN - STEP B: PDF document and fonts created.');
    
    let y = height - 50;

    // Header
    page.drawText('DEVIS', { x: 50, y, font: boldFont, size: 24 });
    y -= 30;
    page.drawText(`Devis #${quote.id}`, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(`Date: ${new Date(quote.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 12 });
    console.log('[DEBUG-CRASH] PDF_GEN - STEP C: Header drawn.');

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
    console.log('[DEBUG-CRASH] PDF_GEN - STEP D: Customer info drawn.');
    
    // Items Table
    y -= 50;
    page.drawText('Description', { x: 50, y, font: boldFont, size: 12 });
    page.drawText('Qté', { x: 350, y, font: boldFont, size: 12 });
    page.drawText('P.U.', { x: 400, y, font: boldFont, size: 12 });
    page.drawText('Total', { x: 480, y, font: boldFont, size: 12 });
    y -= 10;
    page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;
    console.log('[DEBUG-CRASH] PDF_GEN - STEP E: Items table header drawn.');

    items.forEach((item, index) => {
        console.log(`[DEBUG-CRASH] PDF_GEN - LOOP ${index}: Drawing item: ${JSON.stringify(item)}`);
        
        console.log(`[DEBUG-CRASH] PDF_GEN - LOOP ${index}: Drawing description.`);
        page.drawText(item.description || '', { x: 50, y, font, size: 10 });
        
        console.log(`[DEBUG-CRASH] PDF_GEN - LOOP ${index}: Drawing quantity.`);
        page.drawText(String(item.quantity || 0), { x: 350, y, font, size: 10 });

        console.log(`[DEBUG-CRASH] PDF_GEN - LOOP ${index}: Drawing price.`);
        page.drawText(`${(item.price || 0).toFixed(2)} €`, { x: 400, y, font, size: 10 });
        
        console.log(`[DEBUG-CRASH] PDF_GEN - LOOP ${index}: Drawing total item price.`);
        page.drawText(`${((item.price || 0) * (item.quantity || 0)).toFixed(2)} €`, { x: 480, y, font, size: 10 });
        
        y -= 20;
        console.log(`[DEBUG-CRASH] PDF_GEN - LOOP ${index}: Item drawn successfully.`);
    });
    console.log('[DEBUG-CRASH] PDF_GEN - STEP F: All items drawn.');

    // Total
    y -= 10;
    page.drawLine({ start: { x: 350, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;
    page.drawText('Total HT:', { x: 350, y, font: boldFont, size: 14 });
    page.drawText(`${(total || 0).toFixed(2)} €`, { x: 480, y, font: boldFont, size: 14 });
    console.log('[DEBUG-CRASH] PDF_GEN - STEP G: Grand total drawn.');
    
    // Footer
    page.drawText('Merci pour votre confiance.', { x: 50, y: 50, font, size: 10 });
    console.log('[DEBUG-CRASH] PDF_GEN - STEP H: Footer drawn.');

    console.log('[DEBUG-CRASH] PDF_GEN - STEP I: Saving PDF to bytes...');
    const pdfBytes = await pdfDoc.save();
    console.log('[DEBUG-CRASH] PDF_GEN - STEP J: PDF saved to bytes successfully.');
    return pdfBytes;
}
