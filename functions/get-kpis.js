import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
        const url = new URL(context.request.url);
        const period = url.searchParams.get('period') || 'last30days'; // Default to last30days

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        let startDate;
        let endDate = new Date(); // Today

        if (period === 'last30days') {
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
        } else if (period === 'currentYear') {
            startDate = new Date(endDate.getFullYear(), 0, 1); // January 1st of current year
        } else {
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Invalid period parameter' }), { status: 400 }));
        }

        const startDateISO = startDate.toISOString();
        const endDateISO = endDate.toISOString();

        // --- 1. Calculate Revenue ---
        const { data: revenueData, error: revenueError } = await supabase
            .from('invoices')
            .select('total_amount')
            .eq('status', 'paid')
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (revenueError) throw revenueError;
        const totalRevenue = revenueData.reduce((sum, invoice) => sum + (parseFloat(invoice.total_amount) || 0), 0);

        // --- 2. Calculate Total Orders ---
        const { count: totalOrders, error: ordersError } = await supabase
            .from('demandes')
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', '("Refusée", "Annulée")') // Exclude refused/cancelled
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (ordersError) throw ordersError;

        // --- 3. Calculate New Clients ---
        const { count: newClients, error: clientsError } = await supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (clientsError) throw clientsError;

        const kpis = {
            revenue: totalRevenue.toFixed(2),
            totalOrders: totalOrders,
            newClients: newClients,
        };

        return addCorsHeaders(new Response(JSON.stringify(kpis), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('Error in get-kpis function:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}
