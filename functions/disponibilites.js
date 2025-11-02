 import { createClient } from '@supabase/supabase-js';
    
     export async function onRequest(context) {
         if (context.request.method !== 'GET') {
             return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
                 status: 405,
                 headers: { 'Allow': 'GET' }
             });
         }
   
        const supabaseUrl = context.env.SUPABASE_URL;
        const supabaseKey = context.env.SUPABASE_KEY;
   
        if (!supabaseUrl || !supabaseKey) {
            return new Response(JSON.stringify({ error: 'Configuration Supabase manquante.' }), { status: 500
      });
        }
   
        try {
            const supabase = createClient(supabaseUrl, supabaseKey);
   
            const { data: bookings, error } = await supabase
                .from('bookings')
                .select('booking-date');
   
            if (error) {
                throw error;
            }
   
            const bookedDates = bookings.map(b => b['booking-date']);
   
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
   
            return new Response(JSON.stringify({ unavailableDates }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
   
        } catch (error) {
            console.error('API/disponibilites Error:', error);
            return new Response(JSON.stringify({ error: 'Une erreur interne du serveur est survenue.' }), {
      status: 500 });
        }
    }