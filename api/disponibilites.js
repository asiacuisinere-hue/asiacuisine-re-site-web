import { createPool } from '@vercel/postgres';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = createPool({
  connectionString: process.env.POSTGRES_URL,
});

export default async function handler(req, res) {
    // Handle pre-flight CORS requests
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // Fetch all booked dates from the database
        const { rows: bookedRows } = await pool.sql`SELECT booking_date FROM bookings;`;
        const bookedDates = bookedRows.map(row => row.booking_date.toISOString().split('T')[0]);

        const unavailableDates = [...bookedDates];
        const today = new Date();

        // Generate unavailability for weekends (Sunday & Monday) for the next 90 days
        for (let i = 0; i < 90; i++) {
            const date = new Date();
            date.setUTCDate(today.getUTCDate() + i);
            date.setUTCHours(0, 0, 0, 0);

            const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 1 = Monday

            if (dayOfWeek === 0 || dayOfWeek === 1) {
                const dateString = date.toISOString().split('T')[0];
                if (!unavailableDates.includes(dateString)) {
                    unavailableDates.push(dateString);
                }
            }
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ unavailableDates });

    } catch (error) {
        console.error('API/disponibilites Error:', error);

        // If the table doesn't exist yet, it's not a server error. Return an empty array.
        if (error.message.includes('relation "bookings" does not exist')) {
            return res.status(200).json({ unavailableDates: [] });
        }
        
        return res.status(500).json({ error: 'Une erreur interne du serveur est survenue.' });
    }
}