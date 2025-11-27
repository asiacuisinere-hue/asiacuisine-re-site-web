import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// --- CORS Headers Helper ---
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
}

// --- Handle OPTIONS (CORS Preflight) ---
export async function onRequestOptions(context) {
    return new Response(null, {
        status: 204,
        headers: corsHeaders()
    });
}

// --- Handle POST Requests ---
export async function onRequestPost(context) {
    try {
        const authHeader = context.request.headers.get('Authorization');
        if (authHeader !== `Bearer ${context.env.ADMIN_PASSWORD}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders() });
        }

        const body = await context.request.json();
        const { customer, items, total, type, demandeId } = body; // <-- Accepter demandeId

        if (!customer || !customer.id || !items || items.length === 0 || total === undefined || !type) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders() });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // --- 1. Insert Quote ---
        const { data: quoteData, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                demande_id: demandeId, // <-- Sauvegarder demandeId
                client_id: customer.id, // En supposant que customer.id est le client_id
                total_amount: total,
                status: 'draft',
                type: type,
            })
            .select()
            .single();

        if (quoteError) throw quoteError;

        // --- 2. Insert Quote Items ---
        const quoteItems = items.map(item => ({
            quote_id: quoteData.id,
            service_id: item.service_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.price,
        }));
        
        const { error: itemsError } = await supabase.from('quote_items').insert(quoteItems);
        if (itemsError) throw itemsError;

        // --- 3. Generate PDF ---
        const pdfBytes = await generateQuotePDF(quoteData, customer, items, total);

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                ...corsHeaders(),
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="devis-${quoteData.id}.pdf"`,
            }
        });

    } catch (error) {
        console.error('Error in create-quote:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: corsHeaders()
        });
    }
}

// --- PDF Generation Helper ---
async function generateQuotePDF(quote, customer, items, total) {
    // (Le code de génération de PDF reste le même, mais sans les logs de débogage)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;
    page.drawText('DEVIS', { x: 50, y, font: boldFont, size: 24 });
    y -= 30;
    page.drawText(`Devis #${quote.id}`, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(`Date: ${new Date(quote.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 12 });
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
    y -= 10;
    page.drawLine({ start: { x: 350, y }, end: { x: width - 50, y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;
    page.drawText('Total HT:', { x: 350, y, font: boldFont, size: 14 });
    page.drawText(`${(total || 0).toFixed(2)} €`, { x: 480, y, font: boldFont, size: 14 });
    page.drawText('Merci pour votre confiance.', { x: 50, y: 50, font, size: 10 });
    return await pdfDoc.save();
}