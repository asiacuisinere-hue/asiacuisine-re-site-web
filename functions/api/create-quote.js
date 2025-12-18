import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Resend } from 'resend';

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
        const { customer, items, total, type, demandId } = body;

        if (!customer || !customer.id || !items || items.length === 0 || total === undefined || !type || !demandId) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: corsHeaders() });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // --- 1. Insert Quote ---
        const { data: quoteData, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                demand_id: demandId,
                client_id: customer.id,
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
        
        // --- 4. Convert PDF to Base64 ---
        let binaryString = '';
        pdfBytes.forEach((byte) => {
            binaryString += String.fromCharCode(byte);
        });
        const base64Content = btoa(binaryString);

        // --- 5. Send Email with PDF Attachment ---
        const resend = new Resend(context.env.RESEND_API_KEY);
        const recipientEmail = customer.email;
        const recipientName = customer.last_name || 'Client';

        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: recipientEmail,
            subject: 'Votre devis Asiacuisine.re',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h1>Bonjour ${recipientName},</h1>
                    <p>Veuillez trouver ci-joint votre devis personnalisé.</p>
                    <p>N'hésitez pas à nous contacter si vous avez des questions ou si vous souhaitez procéder à la réservation.</p>
                    <p>Cordialement,</p>
                    <p>L'équipe Asiacuisine.re</p>
                </div>
            `,
            attachments: [{
                filename: `devis_${quoteData.id.substring(0, 8)}.pdf`,
                content: base64Content,
            }],
        });

        // --- 6. Update Quote Status ---
        const { error: updateError } = await supabase
            .from('quotes')
            .update({ status: 'sent' })
            .eq('id', quoteData.id);

        if (updateError) throw new Error(`Failed to update quote status: ${updateError.message}`);

        // --- 7. Return Success Response ---
        return new Response(JSON.stringify({
            success: true,
            message: `Devis ${quoteData.id.substring(0, 8)} créé et envoyé avec succès.`,
        }), {
            status: 200,
            headers: corsHeaders()
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
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = height - 50;
    page.drawText('DEVIS', { x: 50, y, font: boldFont, size: 24 });
    y -= 30;
    page.drawText(`Devis #${quote.id.substring(0, 8)}`, { x: 50, y, font, size: 12 });
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