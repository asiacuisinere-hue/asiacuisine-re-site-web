 import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
    
     export async function onRequest(context) {
         if (context.request.method !== 'POST') {
             return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
                 status: 405,
                 headers: { 'Allow': 'POST' }
             });
         }
   
        const supabaseUrl = context.env.SUPABASE_URL;
        const supabaseKey = context.env.SUPABASE_KEY;
   
        if (!supabaseUrl || !supabaseKey) {
            return new Response(JSON.stringify({ error: 'Configuration Supabase manquante.' }), { status: 500
      });
        }
   
        try {
            const { service, date, nom, email, telephone, message } = await context.request.json();
   
            if (!service || !date || !nom || !email) {
                return new Response(JSON.stringify({ error: "Les champs obligatoires doivent être remplis."
      }), { status: 400 });
            }
   
            const supabase = createClient(supabaseUrl, supabaseKey);
   
            const { error } = await supabase
                .from('bookings')
                .insert([{ service, "booking-date": date, name: nom, email, phone: telephone, message }]);
   
            if (error) {
                console.error('Supabase Error:', error);
                if (error.code === '23505') {
                    return new Response(JSON.stringify({ error: 'Cette date est déjà réservée.' }), { status:
      409 });
                }
                throw error;
            }

            // Send email notification with Resend
            const resendApiKey = context.env.RESEND_API_KEY;
            if (resendApiKey) {
                try {
                    const resend = new Resend(resendApiKey);
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
                    console.log('Email notification sent successfully.');
                } catch (emailError) {
                    console.error('Failed to send email notification:', emailError);
                }
            } else {
                console.warn('RESEND_API_KEY is not set. Skipping email notification.');
            }

            return new Response(JSON.stringify({ message: 'Réservation enregistrée avec succès.' }), { status:
      200 });
   
        } catch (error) {
            console.error('Internal Server Error:', error);
            return new Response(JSON.stringify({ error: 'Une erreur interne du serveur est survenue.' }), {
      status: 500 });
        }
    }