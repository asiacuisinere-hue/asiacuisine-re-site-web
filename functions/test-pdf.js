import { PDFDocument } from 'pdf-lib';

export async function onRequestGet(context) {
    try {
        console.log('--- [DEBUG] test-pdf: Function started.');
        
        const pdfDoc = await PDFDocument.create();
        console.log('--- [DEBUG] test-pdf: PDFDocument created.');

        return new Response("PDFDocument created successfully!", { status: 200 });

    } catch (error) {
        console.error('--- [ERROR] test-pdf: Caught exception:', error.message);
        return new Response(`Error: ${error.message}`, { status: 500 });
    }
}
