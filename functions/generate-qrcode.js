import QRCode from 'qrcode';

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
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        const { demandId } = await context.request.json();

        if (!demandId) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing required field: demandId' }), { status: 400 }));
        }

        const url = `https://www.asiacuisine.re/suivi?id=${demandId}`;
        const qrCodeImage = await QRCode.toDataURL(url);

        // Return the QR code as a data URL
        let response = new Response(JSON.stringify({ qrCodeImage }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        return addCorsHeaders(response);

    } catch (error) {
        console.error('Error generating QR code:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}
