import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    const { service, date, nom, email, telephone, message } = req.body;

    // Basic validation (can be improved)
    if (!service || !date || !nom || !email) {
        return res.status(400).json({ error: "Les champs obligatoires doivent être remplis." });
    }

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

        const { data, error } = await supabase
            .from('bookings')
            .insert([{ 
                service,
                booking_date: date,
                name: nom,
                email,
                phone: telephone,
                message 
            }]);

        if (error) {
            console.error('Supabase Error:', error);
            // Handle unique constraint violation for booking_date
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Cette date est déjà réservée. Veuillez en choisir une autre.' });
            }
            throw error;
        }

        return res.status(200).json({ message: 'Réservation enregistrée avec succès.' });

    } catch (error) {
        console.error('Internal Server Error:', error);
        return res.status(500).json({ error: 'Une erreur interne du serveur est survenue.' });
    }
}