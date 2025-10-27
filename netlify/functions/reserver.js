import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: `Method ${event.httpMethod} Not Allowed` }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Configuration Supabase manquante.' }) };
    }

    try {
        const { service, date, nom, email, telephone, message } = JSON.parse(event.body);

        if (!service || !date || !nom || !email) {
            return { statusCode: 400, body: JSON.stringify({ error: "Les champs obligatoires doivent être remplis." }) };
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error } = await supabase
            .from('bookings')
            .insert([{ service, "booking-date": date, name: nom, email, phone: telephone, message }]);

        if (error) {
            console.error('Supabase Error:', error);
            if (error.code === '23505') {
                return { statusCode: 409, body: JSON.stringify({ error: 'Cette date est déjà réservée.' }) };
            }
            throw error;
        }

        return { statusCode: 200, body: JSON.stringify({ message: 'Réservation enregistrée avec succès.' }) };

    } catch (error) {
        console.error('Internal Server Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Une erreur interne du serveur est survenue.' }) };
    }
};