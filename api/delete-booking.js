import { createPool } from '@vercel/postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = createPool({
  connectionString: process.env.POSTGRES_URL,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST requests allowed' });
    }

    const { password, id } = req.body;

    // Authenticate the request
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Mot de passe incorrect' });
    }

    if (!id) {
        return res.status(400).json({ message: 'ID de réservation manquant.' });
    }

    try {
        await pool.sql`DELETE FROM bookings WHERE id = ${id};`;
        res.status(200).json({ success: true, message: 'Réservation supprimée avec succès.' });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de la réservation.' });
    }
}
