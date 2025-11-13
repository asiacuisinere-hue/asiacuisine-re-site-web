import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

async function generateInvoicePdf(invoice, customer, items) {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = height - 50;

    // Header
    page.drawText('Facture Asiacuisine.re', { x: 50, y, font: boldFont, size: 24, color: rgb(0.83, 0.68, 0.21) });
    y -= 30;

    // Invoice Info
    page.drawText(`Facture #: ${invoice.id.substring(0, 8)}`, { x: 50, y, font, size: 12 });
    y -= 15;
    page.drawText(`Date: ${new Date(invoice.created_at).toLocaleDateString('fr-FR')}`, { x: 50, y, font, size: 12 });
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
    page.drawText('Total de la facture:', { x: 350, y, font: boldFont, size: 14 });
    page.drawText(`${invoice.total_amount.toFixed(2)} €`, { x: 450, y, font: boldFont, size: 14 });

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

export async function onRequest(context) {
    // Handle preflight requests
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 }));
    }

    try {
        const { invoiceId } = await context.request.json();
        if (!invoiceId) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'invoiceId is required' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch invoice details, customer, and items
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select(`
                *,
                clients (id, first_name, last_name, email, phone),
                entreprises (id, nom_entreprise, contact_name, contact_email, contact_phone),
                invoice_items (*)
            `)
            .eq('id', invoiceId)
            .single();

        if (invoiceError) throw new Error(`Failed to fetch invoice: ${invoiceError.message}`);
        if (!invoice) throw new Error('Invoice not found.');

        // Determine customer details for PDF and email
        let customerDetails = {};
        let recipientEmail = '';
        let recipientName = '';

        if (invoice.clients) {
            customerDetails = {
                type: 'client',
                id: invoice.clients.id,
                first_name: invoice.clients.first_name,
                last_name: invoice.clients.last_name,
                email: invoice.clients.email,
                phone: invoice.clients.phone,
            };
            recipientEmail = invoice.clients.email;
            recipientName = `${invoice.clients.first_name} ${invoice.clients.last_name}`;
        } else if (invoice.entreprises) {
            customerDetails = {
                type: 'entreprise',
                id: invoice.entreprises.id,
                nom_entreprise: invoice.entreprises.nom_entreprise,
                contact_name: invoice.entreprises.contact_name,
                contact_email: invoice.entreprises.contact_email,
                contact_phone: invoice.entreprises.contact_phone,
            };
            recipientEmail = invoice.entreprises.contact_email;
            recipientName = invoice.entreprises.contact_name;
        } else {
            throw new Error('No client or entreprise found for this invoice.');
        }

        // 2. Generate the PDF
        const pdfBytes = await generateInvoicePdf(invoice, customerDetails, invoice.invoice_items);

        // Convert Uint8Array to Base64 string
        let binaryString = '';
        pdfBytes.forEach((byte) => {
            binaryString += String.fromCharCode(byte);
        });
        const base64Content = btoa(binaryString);

        // 3. Send email with PDF attachment
        const resend = new Resend(context.env.RESEND_API_KEY);
        
        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: recipientEmail,
            subject: 'Votre facture Asiacuisine.re',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h1>Bonjour ${recipientName},</h1>
                    <p>Veuillez trouver ci-joint votre facture pour les services rendus.</p>
                    <p>Nous restons à votre disposition pour toute question.</p>
                    <p>Cordialement,</p>
                    <p>L'équipe Asiacuisine.re</p>
                </div>
            `,
            attachments: [{
                filename: `facture_${invoice.id.substring(0, 8)}.pdf`,
                content: base64Content,
            }],
        });

        // 4. Update invoice status to 'En attente de paiement'
        const { error: updateError } = await supabase
            .from('invoices')
            .update({ status: 'En attente de paiement' })
            .eq('id', invoiceId);

        if (updateError) throw new Error(`Failed to update invoice status: ${updateError.message}`);

        return addCorsHeaders(new Response(JSON.stringify({
            success: true,
            message: `Facture ${invoice.id.substring(0, 8)} envoyée et statut mis à jour.`,
        }), { status: 200 }));

    } catch (error) {
        console.error('Error sending invoice:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}
