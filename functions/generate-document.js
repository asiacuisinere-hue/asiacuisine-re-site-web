import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

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
    // Handle preflight requests for CORS
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        const { demandeId, documentType } = await context.request.json();

        if (!demandeId || !documentType) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 }));
        }

        // 1. Initialiser Supabase
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 2. Récupérer les données de la demande et du client
        const { data: demande, error } = await supabase
            .from('demandes')
            .select(`*,
                clients(*)
            `)
            .eq('id', demandeId)
            .single();

        if (error) throw error;

        // 3. Créer le document PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // --- Contenu du PDF ---
        let yPosition = height - 50;
        page.drawText(`${documentType} - Asiacuisine.re`, { x: 50, y: yPosition, size: 24, font: boldFont });
        yPosition -= 50;

        page.drawText(`Client: ${demande.clients.last_name} ${demande.clients.first_name || ''}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 20;
        page.drawText(`Email: ${demande.clients.email}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 40;

        page.drawText(`Date de la demande: ${new Date(demande.request_date).toLocaleDateString('fr-FR')}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 20;
        page.drawText(`Type: ${demande.type}`, { x: 50, y: yPosition, size: 12, font });
        yPosition -= 40;

        // Lignes de produits/services
        let totalAmount = 0;
        if (demande.type === 'COMMANDE_MENU') {
            const formulaName = demande.details_json.formulaName;
            const price = formulaPrices[formulaName] || 0;
            totalAmount = price;

            page.drawText(formulaName, { x: 50, y: yPosition, size: 12, font });
            page.drawText(`${price.toFixed(2)} €`, { x: width - 150, y: yPosition, size: 12, font });
            yPosition -= 20;
        }
        // TODO: Ajouter la logique pour RESERVATION_SERVICE

        // Total
        yPosition -= 20;
        page.drawLine({ start: { x: 50, y: yPosition }, end: { x: width - 50, y: yPosition }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
        yPosition -= 20;
        page.drawText('Total', { x: 50, y: yPosition, size: 14, font: boldFont });
        page.drawText(`${totalAmount.toFixed(2)} €`, { x: width - 150, y: yPosition, size: 14, font: boldFont });

        const pdfBytes = await pdfDoc.save();

        // 4. Générer le nom du document
        const docName = generateDocName(documentType, 1); // Position est à 1 pour l'instant

        // TODO: 5. Sauvegarder le PDF dans Supabase Storage et l'entrée dans la table 'documents'

        let response = new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${docName}.pdf"`
            }
        });
        return addCorsHeaders(response);

    } catch (error) {
        console.error('Error generating document:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}
