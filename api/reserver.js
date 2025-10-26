import { createPool } from '@vercel/postgres';
import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config({ path: '.env.local' });

const pool = createPool({
  connectionString: process.env.POSTGRES_URL,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        const { service, date, personnes, nom, email, telephone, message } = req.body;

        if (!service || !date || !nom || !email) {
            return res.status(400).json({ error: 'Les champs obligatoires doivent être remplis.' });
        }

        await pool.sql`
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                service VARCHAR(255) NOT NULL,
                booking_date DATE NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        await pool.sql`
            INSERT INTO bookings (service, booking_date, name, email, phone, message)
            VALUES (${service}, ${date}, ${nom}, ${email}, ${telephone || null}, ${message || null});
        `;

        // --- Send Emails ---
        try {
            // Email to the customer
            await resend.emails.send({
                from: 'reservation@asiacuisine.re',
                to: email,
                subject: 'Confirmation de votre demande de réservation',
                html: `
                    <h1>Merci pour votre réservation, ${nom} !</h1>
                    <p>Nous avons bien reçu votre demande pour le service suivant :</p>
                    <ul>
                        <li><strong>Service :</strong> ${service}</li>
                        <li><strong>Date :</strong> ${date}</li>
                        <li><strong>Nombre de personnes :</strong> ${personnes}</li>
                    </ul>
                    <p>Nous vous recontacterons très prochainement pour confirmer les détails.</p>
                    <p>L'équipe Asiacuisine.re</p>
                `
            });

            // Notification email to the admin
            await resend.emails.send({
                from: 'notification@asiacuisine.re',
                to: 'contact@asiacuisine.re', // Your email
                subject: 
`Nouvelle demande de réservation de ${nom}`,
                html: `
                    <h1>Nouvelle demande de réservation</h1>
                    <p>Une nouvelle demande a été faite sur le site :</p>
                    <ul>
                        <li><strong>Nom :</strong> ${nom}</li>
                        <li><strong>Email :</strong> ${email}</li>
                        <li><strong>Téléphone :</strong> ${telephone || 'Non fourni'}</li>
                        <li><strong>Service :</strong> ${service}</li>
                        <li><strong>Date :</strong> ${date}</li>
                        <li><strong>Personnes :</strong> ${personnes}</li>
                        <li><strong>Message :</strong> ${message || 'Aucun'}</li>
                    </ul>
                `
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Do not block the response for an email error. The booking is saved.
        }

        return res.status(200).json({ message: 'Réservation enregistrée avec succès.' });

    } catch (error) {
        console.error('Database Error:', error);
        if (error.code === '23505') { // PostgreSQL unique violation
            return res.status(409).json({ error: 'Cette date vient d\'être réservée. Veuillez en choisir une autre.' });
        }
        return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
}
