import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import QRCode from 'qrcode';

// Helper function to add CORS headers
const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    console.log('--- [DEBUG] Invocation de send-qrcode ---');

    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    try {
        const { demandeId } = await context.request.json();
        console.log(`[DEBUG] send-qrcode: Paramètre reçu: demandeId=${demandeId}`);

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        const resend = new Resend(context.env.RESEND_API_KEY);
        console.log('[DEBUG] send-qrcode: Clients Supabase et Resend initialisés.');

        const { data: demande, error } = await supabase.from('demandes').select('id, clients (email, first_name)').eq('id', demandeId).single();
        if (error || !demande) {
            throw new Error(error?.message || 'Demande non trouvée dans send-qrcode');
        }
        console.log('[DEBUG] send-qrcode: Données récupérées pour le client:', demande.clients.email);

        console.log('[DEBUG] send-qrcode: Tentative de génération du QR code...');
        const qrCodeDataUrl = await QRCode.toDataURL(`https://www.asiacuisine.re/suivi?id=${demande.id}`);
        console.log('[DEBUG] send-qrcode: QR code généré avec succès.');
        
        const qrCodeBase64 = qrCodeDataUrl.split(',')[1];

        console.log('[DEBUG] send-qrcode: Tentative d\'envoi de l\'e-mail...');
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
        console.log('[DEBUG] send-qrcode: E-mail envoyé avec succès.');

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
