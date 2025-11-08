import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Helper function to add CORS headers
const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

// Helper to generate the document name
const generateDocName = (type, position) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const week = Math.ceil(day / 7);
    const randomKey = Math.random().toString(36).substring(2, 8).toUpperCase();
    const prefix = type === 'Devis' ? 'D' : 'F';
    return `${prefix}_${year}_${month}_${week}_${day}_${position}_${randomKey}`;
}

// Prices for menu formulas
const formulaPrices = {
    "Formule Découverte (39€)": 39,
    "Formule Standard (49€)": 49,
    "Formule Confort (59€)": 59,
    "Option Duo (94€)": 94
};

export async function onRequest(context) {
    console.log('--- [DEBUG] Invocation de generate-document ---');

    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        const { demandeId, documentType, sendEmail } = await context.request.json();
        console.log(`[DEBUG] Paramètres reçus: demandeId=${demandeId}, documentType=${documentType}, sendEmail=${sendEmail}`);

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        console.log('[DEBUG] Client Supabase initialisé.');

        const { data: demande, error } = await supabase.from('demandes').select(`*, clients(*)`).eq('id', demandeId).single();
        if (error) throw error;
        console.log('[DEBUG] Données de la demande récupérées pour le client:', demande.clients.email);

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let yPosition = height - 50;
        page.drawText(`${documentType} - Asiacuisine.re`, { x: 50, y: yPosition, size: 24, font: boldFont });
        yPosition -= 50;
        page.drawText(`Client: ${demande.clients.last_name} ${demande.clients.first_name || ''}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 20;
        page.drawText(`Email: ${demande.clients.email}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 40;
        page.drawText(`Date: ${new Date(demande.request_date).toLocaleDateString('fr-FR')}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 20;
        page.drawText(`Type: ${demande.type}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 40;

        let totalAmount = 0;
        if (demande.type === 'COMMANDE_MENU') {
            const formulaName = demande.details_json.formulaName;
            const price = formulaPrices[formulaName] || 0;
            totalAmount = price;
            page.drawText(formulaName, { x: 50, y: yPosition, size: 12, font });
            page.drawText(`${price.toFixed(2)} €`, { x: width - 150, y: yPosition, size: 12, font });
            yPosition -= 20;
        }

        yPosition -= 20;
        page.drawLine({ start: { x: 50, y: yPosition }, end: { x: width - 50, y: yPosition }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
        yPosition -= 20;
        page.drawText('Total', { x: 50, y: yPosition, size: 14, font: boldFont });
        page.drawText(`${totalAmount.toFixed(2)} €`, { x: width - 150, y: yPosition, size: 14, font: boldFont });

        const pdfBytes = await pdfDoc.save();
        const docName = generateDocName(documentType, 1);
        console.log('[DEBUG] PDF généré avec succès.');

        if (sendEmail) {
            console.log('[DEBUG] Début du bloc d\'envoi d\'e-mail.');
            const resendApiKey = context.env.RESEND_API_KEY;
            if (!resendApiKey) {
                console.error('[ERREUR] La variable d\'environnement RESEND_API_KEY est manquante !');
                throw new Error('RESEND_API_KEY is not configured on the server.');
            }
            console.log('[DEBUG] Clé API Resend trouvée.');
            
            const resend = new Resend(resendApiKey);
            await resend.emails.send({
                from: 'contact@asiacuisine.re',
                to: demande.clients.email,
                subject: `Votre ${documentType} de Asiacuisine.re`,
                html: `Bonjour ${demande.clients.first_name || ''},<br><br>Veuillez trouver ci-joint votre ${documentType.toLowerCase()}.<br><br>Cordialement,<br>L'équipe Asiacuisine.re`,
                attachments: [{ filename: `${docName}.pdf`, content: pdfBytes }],
            });
            console.log('[DEBUG] E-mail envoyé avec succès.');
        } else {
            console.log('[DEBUG] L\'envoi d\'e-mail a été ignoré (sendEmail=false).');
        }

        let response = new Response(pdfBytes, {
            status: 200,
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${docName}.pdf"` }
        });
        return addCorsHeaders(response);

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans generate-document ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}
