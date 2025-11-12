import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        const { demandeId } = await context.request.json();
        if (!demandeId) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing demandeId' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // Récupérer la demande avec les infos client/entreprise
        const { data: demande, error } = await supabase
            .from('demandes')
            .select(`
                *,
                clients (first_name, last_name, email),
                entreprises (nom_entreprise, contact_name, contact_email)
            `)
            .eq('id', demandeId)
            .single();

        if (error || !demande) {
            console.error('Error fetching demande for refusal email:', error?.message || 'Demande not found');
            throw new Error(error?.message || 'Demande not found');
        }

        let recipientEmail = '';
        let recipientName = '';

        if (demande.clients) {
            recipientEmail = demande.clients.email;
            recipientName = demande.clients.first_name || demande.clients.last_name || 'Client';
        } else if (demande.entreprises) {
            recipientEmail = demande.entreprises.contact_email;
            recipientName = demande.entreprises.contact_name || demande.entreprises.nom_entreprise || 'Entreprise';
        } else {
            console.error('No client or entreprise found for demande:', demandeId);
            return addCorsHeaders(new Response(JSON.stringify({ error: 'No recipient found for email' }), { status: 400 }));
        }

        if (!recipientEmail) {
            console.error('Recipient email is empty for demande:', demandeId);
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Recipient email is empty' }), { status: 400 }));
        }

        const resend = new Resend(context.env.RESEND_API_KEY);

        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: recipientEmail,
            subject: 'Réponse à votre demande Asiacuisine.re',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h1 style="color: #d4af37;">Bonjour ${recipientName},</h1>
                    <p>Nous avons bien reçu votre demande de service sur Asiacuisine.re.</p>
                    <p>Après examen attentif, nous sommes au regret de vous informer que nous ne pourrons pas donner suite à votre demande pour le moment.</p>
                    <p>Cela peut être dû à diverses raisons (indisponibilité à la date souhaitée, nature spécifique de la demande, etc.).</p>
                    <p>Nous vous remercions de votre intérêt pour Asiacuisine.re et espérons avoir l'occasion de vous servir à l'avenir.</p>
                    <p>Cordialement,</p>
                    <p>L'équipe Asiacuisine.re</p>
                </div>
            `,
        });

        return addCorsHeaders(new Response(JSON.stringify({ success: true, message: 'Refusal email sent successfully.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans send-refusal-email ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}