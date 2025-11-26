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

        // 1. Fetch dates from 'demandes' table, filtered by service_type
        const { data: demandes, error: demandesError } = await supabase
            .from('demandes')
            .select('request_date')
            .eq('type', serviceType) // <-- FILTER ADDED
            .in('status', ['En attente de traitement', 'confirmed', 'En attente de validation de devis', 'En attente de paiement', 'En attente de préparation', 'Préparation en cours']);

        if (demandesError) throw demandesError;

        demandes.forEach(demande => {
            const date = new Date(demande.request_date);
            if (date >= today) {
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                unavailableDates.add(`${day}/${month}/${year}`);
            }
        });

        // 2. Fetch dates from 'indisponibilites' table, filtered by service_type
        const { data: indisponibilites, error: indisponibilitesError } = await supabase
            .from('indisponibilites')
            .select('*')
            .eq('service_type', serviceType); // <-- FILTER ADDED

        if (indisponibilitesError) throw indisponibilitesError;

        indisponibilites.forEach(item => {
            if (item.date) {
                const dateParts = item.date.split('-');
                const blockedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                
                if (blockedDate >= today) {
                    unavailableDates.add(`${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`);
                }
            } else if (item.day_of_week !== null) {
                for (let i = 0; i < 365; i++) {
                    const futureDate = new Date();
                    futureDate.setDate(today.getDate() + i);
                    if (futureDate.getDay() === item.day_of_week) {
                        const day = futureDate.getDate().toString().padStart(2, '0');
                        const month = (futureDate.getMonth() + 1).toString().padStart(2, '0');
                        const year = futureDate.getFullYear();
                        unavailableDates.add(`${day}/${month}/${year}`);
                    }
                }
            }
        });

        const sortedUnavailableDates = Array.from(unavailableDates).sort((a, b) => {
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
