import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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
    const colors = ['2c3e50', 'c0392b', '2980b9', '27ae60', 'f39c12', '8e44ad', 'd35400']; // Couleurs sans le #
    const weekNumber = getWeekNumber(new Date());
    return colors[weekNumber % colors.length];
}

// --- Main Function ---

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
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing demandeId' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        const resend = new Resend(context.env.RESEND_API_KEY);

        const { data: demande, error } = await supabase
            .from('demandes')
            .select('id, clients (email, first_name, client_id)')
            .eq('id', demandeId)
            .single();

        if (error || !demande) throw new Error(error?.message || 'Demande non trouvée');
        
        const client = demande.clients;
        if (!client) throw new Error('Client data not found for this demande.');

        // Construire l'URL de l'API pour générer le QR Code
        const weeklyColor = getWeeklyColor();
        const qrData = encodeURIComponent(`https://www.asiacuisine.re/suivi?id=${demande.id}`);
        const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&color=${weeklyColor}`;

        // Envoyer l'e-mail avec l'URL de l'image
        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: client.email,
            subject: `Votre QR code pour votre commande Asiacuisine.re`,
            html: `
                <div style="font-family: sans-serif; text-align: center;">
                    <h1>Bonjour ${client.first_name || ''},</h1>
                    <p>Votre paiement a été confirmé. Merci !</p>
                    <p>Veuillez présenter le QR code ci-dessous lors de la réception de votre commande.</p>
                    <img src="${qrCodeApiUrl}" alt="QR Code de suivi"/>
                    <p style="font-size: 1.2em; font-weight: bold; margin-top: 10px;">
                        ID Client : ${client.client_id || 'N/A'}
                    </p>
                    <br>
                    <p>L'équipe Asiacuisine.re</p>
                </div>
            `,
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
