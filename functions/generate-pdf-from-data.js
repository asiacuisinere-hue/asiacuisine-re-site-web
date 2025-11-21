import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// --- CORS Headers Helper ---
function corsHeaders(isPdf = false) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (isPdf) {
        headers['Content-Type'] = 'application/pdf';
    } else {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

// --- Handle OPTIONS (CORS Preflight) ---
export async function onRequestOptions(context) {
    return new Response(null, { status: 204, headers: corsHeaders() });
}

// --- Handle POST Requests ---
export async function onRequestPost(context) {
    try {
        // --- Authentication (optional but good practice) ---
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || authHeader !== `Bearer ${context.env.ADMIN_PASSWORD}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
        }

        // --- Parse Request Body ---
        const { quote, customer, items, total } = await context.request.json();

        // --- Validate ---
        if (!quote || !quote.id || !quote.created_at || !customer || !items || total === undefined) {
             return new Response(JSON.stringify({ error: 'Missing required data for PDF generation' }), { status: 400, headers: corsHeaders() });
        }

        // --- Generate PDF ---
        const pdfBytes = await generateQuotePDF(quote, customer, items, total);

        // --- Return PDF ---
        const pdfHeaders = corsHeaders(true);
        pdfHeaders['Content-Disposition'] = `attachment; filename="devis-${quote.id}.pdf"`;
        return new Response(pdfBytes, { status: 200, headers: pdfHeaders });

    } catch (error) {
        console.error('--- [ERROR] generate-pdf-from-data: Caught exception:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal Server Error', 
            details: error.message 
        }), { status: 500, headers: corsHeaders() });
    }
}

// --- PDF Generation Helper (self-contained) ---
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
    page.drawText(`Devis #${quote.id.substring(0, 8)}`, { x: 50, y, font, size: 12 });
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
        page.drawText(String(item.quantity || 0), { x: 350, y, font, size: 10 });
        page.drawText(`${(item.price || 0).toFixed(2)} €`, { x: 400, y, font, size: 10 });
        page.drawText(`${((item.price || 0) * (item.quantity || 0)).toFixed(2)} €`, { x: 480, y, font, size: 10 });
        y -= 20;
    });

    // Total
    y -= 10;
    page.drawLine({ start: { x: 350, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;
    page.drawText('Total HT:', { x: 350, y, font: boldFont, size: 14 });
    page.drawText(`${(total || 0).toFixed(2)} €`, { x: 480, y, font: boldFont, size: 14 });
    
    // Footer
    page.drawText('Merci pour votre confiance.', { x: 50, y: 50, font, size: 10 });

    return pdfDoc.save();
}
