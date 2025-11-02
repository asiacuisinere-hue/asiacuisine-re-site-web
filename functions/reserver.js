 import { createClient } from '@supabase/supabase-js';
    
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
   
            return new Response(JSON.stringify({ message: 'Réservation enregistrée avec succès.' }), { status:
      200 });
   
        } catch (error) {
            console.error('Internal Server Error:', error);
            return new Response(JSON.stringify({ error: 'Une erreur interne du serveur est survenue.' }), {
      status: 500 });
        }
    }