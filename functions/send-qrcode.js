import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
const qrcode = require('qrcode-generator');

// Helper function to add CORS headers
const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    try {
        const { demandeId } = await context.request.json();
        if (!demandeId) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing demandeId' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        const resend = new Resend(context.env.RESEND_API_KEY);

        const { data: demande, error } = await supabase.from('demandes').select('id, clients (email, first_name)').eq('id', demandeId).single();
        if (error || !demande) {
            throw new Error(error?.message || 'Demande non trouvée');
        }

        // Générer le QR code avec la nouvelle librairie
        const qr = qrcode(0, 'M');
        qr.addData(`https://www.asiacuisine.re/suivi?id=${demande.id}`);
        qr.make();
        const qrCodeDataUrl = qr.createDataURL(4); // 4 = cell size
        const qrCodeBase64 = qrCodeDataUrl.split(',')[1];

        // Envoyer l'e-mail
        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: demande.clients.email,
            subject: `Votre QR code pour votre commande Asiacuisine.re`,
            html: `
                <h1>Bonjour ${demande.clients.first_name || ''},</h1>
                <p>Votre paiement a été confirmé. Merci !</p>
                <p>Veuillez présenter le QR code ci-dessous lors de la réception de votre commande.</p>
                <p>L'équipe Asiacuisine.re</p>
                <img src="cid:qrcode.png" alt="QR Code de suivi"/>
            `,
            attachments: [
                {
                    filename: 'qrcode.png',
                    content: qrCodeBase64,
                    cid: 'qrcode.png'
                }
            ],
        });

        return addCorsHeaders(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans send-qrcode ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}