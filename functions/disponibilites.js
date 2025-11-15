import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Allow all origins for this public function
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'GET') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'GET' } }));
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);

        const unavailableDates = new Set();

        // 1. Fetch dates from 'demandes' table (existing logic)
        const { data: demandes, error: demandesError } = await supabase
            .from('demandes')
            .select('request_date')
            .in('status', ['En attente de traitement', 'En attente de validation de devis', 'En attente de paiement', 'En attente de préparation', 'Préparation en cours', 'Confirmée']);

        if (demandesError) {
            console.error('Error fetching demandes for unavailable dates:', demandesError);
            throw demandesError;
        }

        demandes.forEach(demande => {
            unavailableDates.add(demande.request_date);
        });

        // 2. Fetch dates from 'indisponibilites' table (new logic)
        const { data: indisponibilites, error: indisponibilitesError } = await supabase
            .from('indisponibilites')
            .select('*');

        if (indisponibilitesError) {
            console.error('Error fetching indisponibilites:', indisponibilitesError);
            throw indisponibilitesError;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        indisponibilites.forEach(item => {
            if (item.date) {
                // Specific date blocked
                const blockedDate = new Date(item.date);
                blockedDate.setHours(0, 0, 0, 0);
                if (blockedDate >= today) { // Only add future or current dates
                    unavailableDates.add(item.date);
                }
            } else if (item.day_of_week !== null) {
                // Recurring day of week blocked
                // Add all future occurrences of this day of week for the next year
                for (let i = 0; i < 365; i++) {
                    const futureDate = new Date(today);
                    futureDate.setDate(today.getDate() + i);
                    if (futureDate.getDay() === item.day_of_week) {
                        unavailableDates.add(futureDate.toISOString().split('T')[0]);
                    }
                }
            }
        });

        const sortedUnavailableDates = Array.from(unavailableDates).sort();

        return addCorsHeaders(new Response(JSON.stringify(sortedUnavailableDates), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans disponibilites ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}