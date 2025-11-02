import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function onRequest(context) {
    console.log('[/reserver] Function invoked.');
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
            status: 405,
            headers: { 'Allow': 'POST' }
        });
    }

    try {
        console.log('[/reserver] Inside try block.');
        const { service, date, nom, email, telephone, message } = await context.request.json();
        console.log('[/reserver] Request body parsed.');

        if (!service || !date || !nom || !email) {
            console.error('[/reserver] Validation failed: Missing required fields.');
            return new Response(JSON.stringify({ error: "Les champs obligatoires doivent être remplis." }), { status: 400 });
        }

        const supabaseUrl = context.env.SUPABASE_URL;
        const supabaseKey = context.env.SUPABASE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            console.error('[/reserver] Supabase credentials missing.');
            return new Response(JSON.stringify({ error: 'Configuration Supabase manquante.' }), { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseKey);
        console.log('[/reserver] Supabase client created.');

        const { error } = await supabase
            .from('bookings')
            .insert([{ service, "booking-date": date, name: nom, email, phone: telephone, message }]);
        console.log('[/reserver] Supabase insert attempted.');

        if (error) {
            console.error('[/reserver] Supabase Error:', error);
            if (error.code === '23505') {
                return new Response(JSON.stringify({ error: 'Cette date est déjà réservée.' }), { status: 409 });
            }
            throw error; // Re-throw other Supabase errors
        }
        console.log('[/reserver] Supabase insert successful.');

        const resendApiKey = context.env.RESEND_API_KEY;
        if (resendApiKey) {
            console.log('[/reserver] RESEND_API_KEY found. Attempting to send email.');
            try {
                const resend = new Resend(resendApiKey);
                console.log('[/reserver] Resend client instantiated.');
                await resend.emails.send({
                    from: 'reservation@asiacuisine.re',
                    to: 'contact@asiacuisine.re',
                    subject: `Nouvelle demande de réservation - ${nom}`,
                    html: `
                        <h1>Nouvelle demande de réservation</h1>
                        <p>Une nouvelle demande de réservation a été effectuée sur le site.</p>
                        <ul>
                            <li><strong>Service:</strong> ${service}</li>
                            <li><strong>Date:</strong> ${date}</li>
                            <li><strong>Nom:</strong> ${nom}</li>
                            <li><strong>Email:</strong> ${email}</li>
                            <li><strong>Téléphone:</strong> ${telephone || 'Non fourni'}</li>
                            <li><strong>Message:</strong> ${message || 'Aucun'}</li>
                        </ul>
                    `
                });
                console.log('[/reserver] Email notification sent successfully.');
            } catch (emailError) {
                console.error('[/reserver] Failed to send email notification:', emailError);
            }
        } else {
            console.warn('[/reserver] RESEND_API_KEY is not set. Skipping email notification.');
        }

        console.log('[/reserver] Returning 200 OK response.');
        return new Response(JSON.stringify({ message: 'Réservation enregistrée avec succès.' }), { status: 200 });

    } catch (error) {
        console.error('[/reserver] Unhandled error in outer catch block:', error);
        return new Response(JSON.stringify({ error: 'Une erreur interne du serveur est survenue.', details: error.message }), { status: 500 });
    }
}