const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: `Method ${event.httpMethod} Not Allowed` }),
            headers: { 'Allow': 'GET' }
        };
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
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Une erreur interne du serveur est survenue.' })
        };
    }
};