import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// Helper function to add CORS headers
const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    // Handle preflight requests for CORS
    if (context.request.method === 'OPTIONS') {
        let response = new Response(null, { status: 204 });
        return addCorsHeaders(response);
    }

    if (context.request.method !== 'POST') {
        let response = new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
            status: 405,
            headers: { 'Allow': 'POST' }
        });
        return addCorsHeaders(response);
    }

    try {
        const { demandeId, documentType } = await context.request.json();

        if (!demandeId || !documentType) {
            let response = new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
            return addCorsHeaders(response);
        }

        // TODO: Récupérer les données de la demande et du client depuis Supabase

        // Créer un nouveau document PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.drawText(`Ceci est un ${documentType} pour la demande ${demandeId}`,
            { x: 50, y: height - 4 * 50, size: 30, font, color: rgb(0, 0.53, 0.71) });

        const pdfBytes = await pdfDoc.save();

        let response = new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${documentType}_${demandeId}.pdf"`
            }
        });
        return addCorsHeaders(response);

    } catch (error) {
        console.error('Error generating document:', error);
        let response = new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
        return addCorsHeaders(response);
    }
}
