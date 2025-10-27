import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('booking_date');

        if (error) {
            throw error;
        }

        const bookedDates = bookings.map(b => b.booking_date);

        // This part for adding weekends remains the same
        const unavailableDates = [...bookedDates];
        const today = new Date();
        for (let i = 0; i < 90; i++) {
            const date = new Date();
            date.setUTCDate(today.getUTCDate() + i);
            date.setUTCHours(0, 0, 0, 0);
            const dayOfWeek = date.getUTCDay();
            if (dayOfWeek === 0 || dayOfWeek === 1) {
                const dateString = date.toISOString().split('T')[0];
                if (!unavailableDates.includes(dateString)) {
                    unavailableDates.push(dateString);
                }
            }
        }

        return res.status(200).json({ unavailableDates });

    } catch (error) {
        console.error('API/disponibilites Error:', error);
        return res.status(500).json({ error: 'Une erreur interne du serveur est survenue.' });
    }
}