import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
            status: 405,
            headers: { 'Allow': 'POST' }
        });
    }

    try {
        const { demandId, documentType } = await context.request.json();

        if (!demandId || !documentType) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
        }

        // TODO: Récupérer les données de la demande et du client depuis Supabase

        // Créer un nouveau document PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        page.drawText(`Ceci est un ${documentType} pour la demande ${demandId}`,
            { x: 50, y: height - 4 * 50, size: 30, font, color: rgb(0, 0.53, 0.71) });

        const pdfBytes = await pdfDoc.save();

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${documentType}_${demandId}.pdf"`
            }
        });

    } catch (error) {
        console.error('Error generating document:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
    }
}
