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

    const { password } = req.body;

    // Authenticate the request
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Mot de passe incorrect' });
    }

    try {
        const { rows } = await pool.sql`
            SELECT id, service, TO_CHAR(booking_date, 'YYYY-MM-DD') as booking_date, name, email, phone, message 
            FROM bookings 
            ORDER BY booking_date DESC;
        `;
        res.status(200).json({ bookings: rows });
    } catch (error) {
        console.error('Database Error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des réservations.' });
    }
}
