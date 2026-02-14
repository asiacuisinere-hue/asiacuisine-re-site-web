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

    try {
        const url = new URL(context.request.url);
        const serviceType = url.searchParams.get('service_type') || 'COMMANDE_MENU';

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);
        const today = new Date().toISOString().split('T')[0];

        // 1. Récupérer TOUTES les règles d'indisponibilité pour ce service spécifique
        const { data: rules, error: rulesError } = await supabase
            .from('indisponibilites')
            .select('*')
            .eq('service_type', serviceType);

        if (rulesError) throw rulesError;

        // 2. Extraire les jours de la semaine bloqués récursivement (day_of_week : 0=Dim, 1=Lun...)
        const blockedDays = rules
            .filter(r => r.day_of_week !== null)
            .map(r => parseInt(r.day_of_week));

        // 3. Extraire les dates spécifiques bloquées
        const specificBlockedDates = rules
            .filter(r => r.date !== null && r.date >= today)
            .map(r => {
                const [y, m, d] = r.date.split('-');
                return `${d}/${m}/${y}`;
            });

        // 4. Construire l'objet settings pour le site
        // Un jour est "true" (ouvert) seulement s'il N'EST PAS dans blockedDays
        const settings = {
            monday: !blockedDays.includes(1),
            tuesday: !blockedDays.includes(2),
            wednesday: !blockedDays.includes(3),
            thursday: !blockedDays.includes(4),
            friday: !blockedDays.includes(5),
            saturday: !blockedDays.includes(6),
            sunday: !blockedDays.includes(0)
        };

        console.log(`[DEBUG DISPO] Service: ${serviceType} | Blocked: ${blockedDays} | Settings:`, settings);

        return addCorsHeaders(new Response(JSON.stringify({
            unavailableDates: specificBlockedDates,
            settings: settings
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        return addCorsHeaders(new Response(JSON.stringify({ error: error.message }), { status: 500 }));
    }
}
