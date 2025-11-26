import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'GET') {
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 }));
    }

    try {
        const url = new URL(context.request.url);
        const serviceType = url.searchParams.get('service_type');

        if (!serviceType) {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing service_type parameter' }), { status: 400 }));
        }
        
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);
        const unavailableDates = new Set();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // La seule source d'indisponibilité est maintenant la table 'indisponibilites'
        const { data: indisponibilites, error: indisponibilitesError } = await supabase
            .from('indisponibilites')
            .select('*')
            .eq('service_type', serviceType);

        if (indisponibilitesError) throw indisponibilitesError;

        indisponibilites.forEach(item => {
            if (item.date && new Date(item.date) >= today) {
                unavailableDates.add(item.date); // Format YYYY-MM-DD
            } 
            else if (item.day_of_week !== null) {
                for (let i = 0; i < 365; i++) {
                    const futureDate = new Date();
                    futureDate.setDate(today.getDate() + i);
                    if (futureDate.getDay() === item.day_of_week) {
                        unavailableDates.add(futureDate.toISOString().split('T')[0]);
                    }
                }
            }
        });

        // Convertir YYYY-MM-DD en DD/MM/YYYY pour la librairie du calendrier
        const formattedDates = Array.from(unavailableDates).map(d => {
            const [year, month, day] = d.split('-');
            return `${day}/${month}/${year}`;
        });
        
        const sortedUnavailableDates = formattedDates.sort((a, b) => {
            const [dayA, monthA, yearA] = a.split('/');
            const [dayB, monthB, yearB] = b.split('/');
            return new Date(`${yearA}-${monthA}-${dayA}`) - new Date(`${yearB}-${monthB}-${dayB}`);
        });

        return addCorsHeaders(new Response(JSON.stringify(sortedUnavailableDates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('Error in disponibilites function:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 }));
    }
}