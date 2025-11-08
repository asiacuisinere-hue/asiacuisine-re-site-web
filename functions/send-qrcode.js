import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { Encoder } from '@nuintun/qrcode';

// --- Helpers ---

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://gestion.asiacuisine.re');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getWeeklyColor() {
    const colors = ['#2c3e50', '#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#d35400'];
    const weekNumber = getWeekNumber(new Date());
    return colors[weekNumber % colors.length];
}

// --- Main Function ---

export async function onRequest(context) {
    console.log('--- [DEBUG] Invocation de send-qrcode (v2) ---');
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    try {
        const { demandeId } = await context.request.json();
        console.log(`[DEBUG] Paramètre reçu: demandeId=${demandeId}`);

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        const resend = new Resend(context.env.RESEND_API_KEY);
        console.log('[DEBUG] Clients initialisés.');

        const { data: demande, error } = await supabase.from('demandes').select('id, clients (email, first_name, client_id)').eq('id', demandeId).single();
        if (error || !demande) throw new Error(error?.message || 'Demande non trouvée');
        
        const client = demande.clients;
        if (!client) throw new Error('Client non trouvé pour cette demande.');
        console.log('[DEBUG] Données client récupérées.');

        console.log('[DEBUG] Tentative de génération du PNG QR Code...');
        const qrcode = new Encoder({
            text: `https://www.asiacuisine.re/suivi?id=${demande.id}`,
            size: 256,
            level: 'M',
            color: { dark: getWeeklyColor(), light: '#ffffff' }
        });
        const qrCodeDataUrl = qrcode.toDataURL();
        console.log('[DEBUG] PNG QR Code généré avec succès.');
        
        const qrCodeBase64 = qrCodeDataUrl.split(',')[1];

        console.log('[DEBUG] Tentative d\'envoi de l\'e-mail...');
        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: client.email,
            subject: `Votre QR code pour votre commande Asiacuisine.re`,
            html: `...`, // HTML body omitted for brevity in logging
            attachments: [{
                filename: 'qrcode.png',
                content: qrCodeBase64,
                encoding: 'base64',
                cid: 'qrcode.png'
            }]
        });
        console.log('[DEBUG] E-mail envoyé avec succès.');

        return addCorsHeaders(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans send-qrcode (v2) ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}