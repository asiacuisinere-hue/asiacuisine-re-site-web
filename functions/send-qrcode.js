import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import QRCode from 'qrcode';

export async function onRequest(context) {
    // Seules les requêtes POST sont autorisées
    if (context.request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { demandeId } = await context.request.json();
        if (!demandeId) {
            return new Response(JSON.stringify({ error: 'Missing demandeId' }), { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
        const resend = new Resend(context.env.RESEND_API_KEY);

        // Récupérer les informations de la demande et du client
        const { data: demande, error } = await supabase
            .from('demandes')
            .select('id, clients (email, first_name)')
            .eq('id', demandeId)
            .single();

        if (error || !demande) {
            throw new Error(error?.message || 'Demande not found');
        }

        // Générer le QR code
        const qrCodeDataUrl = await QRCode.toDataURL(`https://www.asiacuisine.re/suivi?id=${demande.id}`);
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

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error sending QR code email:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
