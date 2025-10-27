import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: JSON.stringify({ error: `Method ${event.httpMethod} Not Allowed` }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Configuration Supabase manquante.' }) };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: bookings, error } = await supabase
            .from('bookings')
            .select('booking-date');

        if (error) {
            throw error;
        }

        const bookedDates = bookings.map(b => b.booking_date);

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

        return {
            statusCode: 200,
            body: JSON.stringify({ unavailableDates })
        };

    } catch (error) {
        console.error('API/disponibilites Error:', error);
        return { statusCode: 500, body: JSON.stringify({ error: 'Une erreur interne du serveur est survenue.' }) };
    }
};