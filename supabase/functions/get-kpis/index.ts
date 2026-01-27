import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    console.log("--- [get-kpis] Function invoked ---");
    if (req.method === "OPTIONS") {
        return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== "GET") {
        return new Response(JSON.stringify({ error: `Method ${req.method} Not Allowed` }), {
            status: 405,
            headers: { ...corsHeaders, 'Allow': 'GET' }
        });
    }

    try {
        const url = new URL(req.url);
        const period = url.searchParams.get('period') || 'last30days';
        const businessUnit = url.searchParams.get('businessUnit') || 'cuisine';
        console.log(`[get-kpis] Period requested: ${period}, Business Unit: ${businessUnit}`);

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Calculate dates for the current period
        let startDate: Date;
        let endDate = new Date();

        // Calculate dates for the previous period (for comparisons)
        let previousStartDate: Date;
        let previousEndDate: Date;

        if (period === 'last7days') {
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);
            previousStartDate = new Date(startDate);
            previousStartDate.setDate(startDate.getDate() - 7);
            previousEndDate = new Date(startDate);
        } else if (period === 'last30days') {
            startDate = new Date();
            startDate.setDate(endDate.getDate() - 30);
            previousStartDate = new Date(startDate);
            previousStartDate.setDate(startDate.getDate() - 30);
            previousEndDate = new Date(startDate);
        } else if (period === 'currentMonth') {
            startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
            // Previous period = last month
            previousEndDate = new Date(startDate);
            previousEndDate.setDate(previousEndDate.getDate() - 1);
            previousStartDate = new Date(previousEndDate.getFullYear(), previousEndDate.getMonth(), 1);   
        } else if (period === 'currentYear') {
            startDate = new Date(endDate.getFullYear(), 0, 1);
            // Previous period = last year
            previousStartDate = new Date(endDate.getFullYear() - 1, 0, 1);
            previousEndDate = new Date(endDate.getFullYear() - 1, 11, 31);
        } else {
            return new Response(JSON.stringify({ error: 'Invalid period parameter' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const startDateISO = startDate.toISOString();
        const endDateISO = endDate.toISOString();
        const previousStartDateISO = previousStartDate.toISOString();
        const previousEndDateISO = previousEndDate.toISOString();

        console.log(`[get-kpis] Current period: ${startDateISO} to ${endDateISO}`);
        console.log(`[get-kpis] Previous period: ${previousStartDateISO} to ${previousEndDateISO}`);      

        // --- 1. Calculate Revenue (current period) ---
        console.log("[get-kpis] Fetching current revenue...");
        const { data: revenueData, error: revenueError } = await supabase
            .from('invoices')
            .select('total_amount')
            .eq('status', 'paid')
            .eq('business_unit', businessUnit)
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (revenueError) throw new Error(`Revenue query failed: ${revenueError.message}`);
        const totalRevenue = revenueData.reduce((sum, invoice) => sum + (parseFloat(invoice.total_amount) || 0), 0);

        // Previous period revenue
        const { data: prevRevenueData } = await supabase
            .from('invoices')
            .select('total_amount')
            .eq('status', 'paid')
            .eq('business_unit', businessUnit)
            .gte('created_at', previousStartDateISO)
            .lte('created_at', previousEndDateISO);

        const previousRevenue = (prevRevenueData || []).reduce((sum, invoice) => sum + (parseFloat(invoice.total_amount) || 0), 0);
        const revenueChange = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue * 100) : (totalRevenue > 0 ? 100 : 0);

        console.log(`[get-kpis] Revenue: ${totalRevenue} (change: ${revenueChange}%)`);

        // --- 1.5. Calculate Expenses (current period) ---
        console.log("[get-kpis] Fetching current expenses...");
        const { data: expensesData, error: expensesError } = await supabase
            .from('expenses')
            .select('amount')
            .eq('business_unit', businessUnit)
            .gte('expense_date', startDateISO)
            .lte('expense_date', endDateISO);

        if (expensesError) throw new Error(`Expenses query failed: ${expensesError.message}`);
        const totalExpenses = (expensesData || []).reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

        // Previous period expenses
        const { data: prevExpensesData } = await supabase
            .from('expenses')
            .select('amount')
            .eq('business_unit', businessUnit)
            .gte('expense_date', previousStartDateISO)
            .lte('expense_date', previousEndDateISO);

        const previousExpenses = (prevExpensesData || []).reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
        const expensesChange = previousExpenses > 0 ? ((totalExpenses - previousExpenses) / previousExpenses * 100) : (totalExpenses > 0 ? 100 : 0);

        console.log(`[get-kpis] Expenses: ${totalExpenses} (change: ${expensesChange}%)`);

        // --- 2. Calculate Total Orders ---
        console.log("[get-kpis] Fetching total orders...");
        const { count: totalOrders, error: ordersError } = await supabase
            .from('demandes')
            .select('id', { count: 'exact', head: true })
            .eq('business_unit', businessUnit)
            .not('status', 'in', '("Refusée", "Annulée")')
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (ordersError) throw new Error(`Total orders query failed: ${ordersError.message}`);

        // Previous period orders
        const { count: previousOrders } = await supabase
            .from('demandes')
            .select('id', { count: 'exact', head: true })
            .eq('business_unit', businessUnit)
            .not('status', 'in', '("Refusée", "Annulée")')
            .gte('created_at', previousStartDateISO)
            .lte('created_at', previousEndDateISO);

        const ordersChange = previousOrders > 0 ? ((totalOrders - previousOrders) / previousOrders * 100) : (totalOrders > 0 ? 100 : 0);
        console.log(`[get-kpis] Total orders: ${totalOrders} (change: ${ordersChange}%)`);

        // --- 3. Calculate New Clients ---
        // Clients are shared between units
        console.log("[get-kpis] Fetching new clients...");
        const { count: newClients, error: clientsError } = await supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (clientsError) throw new Error(`New clients query failed: ${clientsError.message}`);

        // Previous period clients
        const { count: previousClients } = await supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', previousStartDateISO)
            .lte('created_at', previousEndDateISO);

        const clientsChange = previousClients > 0 ? ((newClients - previousClients) / previousClients * 100) : (newClients > 0 ? 100 : 0);
        console.log(`[get-kpis] New clients: ${newClients} (change: ${clientsChange}%)`);

        // --- 4. Calculate Gross Margin ---
        const totalGrossMargin = totalRevenue - totalExpenses;
        const previousGrossMargin = previousRevenue - previousExpenses;
        const grossMarginChange = previousGrossMargin > 0 ? ((totalGrossMargin - previousGrossMargin) / previousGrossMargin * 100) : (totalGrossMargin > 0 ? 100 : 0);
        console.log(`[get-kpis] Gross Margin: ${totalGrossMargin} (change: ${grossMarginChange}%)`);      

        // --- 4.5. Calculate Average Order Value ---
        const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;


        // --- 5. Revenue Evolution Data (daily or weekly depending on period) ---
        console.log("[get-kpis] Fetching revenue evolution data...");
        const { data: dailyRevenue, error: dailyError } = await supabase
            .from('invoices')
            .select('created_at, total_amount')
            .eq('status', 'paid')
            .eq('business_unit', businessUnit)
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO)
            .order('created_at', { ascending: true });

        if (dailyError) throw new Error(`Daily revenue query failed: ${dailyError.message}`);

        // Group by day
        const revenueByDay = {};
        dailyRevenue.forEach(invoice => {
            const day = invoice.created_at.split('T')[0];
            if (!revenueByDay[day]) {
                revenueByDay[day] = 0;
            }
            revenueByDay[day] += parseFloat(invoice.total_amount) || 0;
        });

        const revenueEvolutionData = Object.entries(revenueByDay).map(([day, revenue]) => ({
            day,
            revenue: Number(revenue).toFixed(2)
        }));

        // --- 6. Order Type Distribution ---
        console.log("[get-kpis] Fetching order type distribution...");
        const { data: orderTypes, error: orderTypesError } = await supabase
            .from('demandes')
            .select('type')
            .eq('business_unit', businessUnit)
            .not('status', 'in', '("Refusée", "Annulée")')
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (orderTypesError) throw new Error(`Order types query failed: ${orderTypesError.message}`);     

        const typeCount = {};
        orderTypes.forEach(order => {
            typeCount[order.type] = (typeCount[order.type] || 0) + 1;
        });

        const orderTypeDistribution = Object.entries(typeCount).map(([type, count]) => ({
            type,
            count
        }));

        // --- 7. Weekday Performance ---
        console.log("[get-kpis] Fetching weekday performance...");
        const { data: weekdayOrders, error: weekdayError } = await supabase
            .from('demandes')
            .select('created_at')
            .eq('business_unit', businessUnit)
            .not('status', 'in', '("Refusée", "Annulée")')
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        if (weekdayError) throw new Error(`Weekday orders query failed: ${weekdayError.message}`);        

        const { data: weekdayRevenue } = await supabase
            .from('invoices')
            .select('created_at, total_amount')
            .eq('status', 'paid')
            .eq('business_unit', businessUnit)
            .gte('created_at', startDateISO)
            .lte('created_at', endDateISO);

        const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        const weekdayStats = {};

        // Initialize
        dayNames.forEach((day, idx) => {
            weekdayStats[idx] = { day_name: day, total_orders: 0, total_revenue: 0 };
        });

        // Count orders
        weekdayOrders.forEach(order => {
            const dayOfWeek = new Date(order.created_at).getDay();
            weekdayStats[dayOfWeek].total_orders++;
        });

        // Sum revenue
        (weekdayRevenue || []).forEach(invoice => {
            const dayOfWeek = new Date(invoice.created_at).getDay();
            weekdayStats[dayOfWeek].total_revenue += parseFloat(invoice.total_amount) || 0;
        });

        const weekdayPerformance = Object.values(weekdayStats).map(stat => ({
            day_name: stat.day_name,
            total_orders: stat.total_orders,
            total_revenue: stat.total_revenue.toFixed(2)
        }));

        // --- 8. Top Products/Services ---
                console.log("[get-kpis] Fetching top products...");
                const { data: orderItems, error: itemsError } = await supabase
                    .from('demandes')
                    .select('details_json, total_amount')
                    .eq('business_unit', businessUnit)
                    .not('status', 'in', '("Refusée", "Annulée")')
                    .gte('created_at', startDateISO)
                    .lte('created_at', endDateISO);

                if (itemsError) throw new Error(`Order items query failed: ${itemsError.message}`);       

                const productStats = {};

                orderItems.forEach(order => {
                    const items = order.details_json?.items;
                    if (items && Array.isArray(items)) {
                        items.forEach(item => {
                            const itemName = item.name || item.title || 'Produit inconnu';
                            const itemPrice = parseFloat(item.price || item.total || 0);

                            if (!productStats[itemName]) {
                                productStats[itemName] = { total_orders: 0, total_revenue: 0 };
                            }
                            productStats[itemName].total_orders++;
                            productStats[itemName].total_revenue += itemPrice;
                        });
                    }
                });
        const topProductsData = Object.entries(productStats)
            .map(([name, stats]) => ({
                item_name: name,
                total_orders: stats.total_orders,
                total_revenue: stats.total_revenue.toFixed(2),
                average_revenue: (stats.total_revenue / stats.total_orders).toFixed(2)
            }))
            .sort((a, b) => parseFloat(b.total_revenue) - parseFloat(a.total_revenue))
            .slice(0, 10);

        // --- 9. Expense Distribution ---
        console.log("[get-kpis] Fetching expense distribution...");
        const { data: expenseDistribution, error: expenseDistributionError } = await supabase
            .from('expenses')
            .select('category, amount')
            .eq('business_unit', businessUnit)
            .gte('expense_date', startDateISO)
            .lte('expense_date', endDateISO);

        if (expenseDistributionError) throw new Error(`Expense distribution query failed: ${expenseDistributionError.message}`);

        const expenseByCategory = {};
        expenseDistribution.forEach(expense => {
            const category = expense.category || 'Non classé';
            expenseByCategory[category] = (expenseByCategory[category] || 0) + (parseFloat(expense.amount) || 0);
        });

        const expenseDistributionData = Object.entries(expenseByCategory).map(([category, amount]) => ({  
            name: category,
            value: Number(amount)
        }));

        // --- 10. Monthly Performance ---
        console.log("[get-kpis] Fetching monthly performance...");
        const { data: monthlyPerformance, error: monthlyPerformanceError } = await supabase
            .rpc('get_monthly_performance', { p_business_unit: businessUnit });

        if (monthlyPerformanceError) throw new Error(`Monthly performance query failed: ${monthlyPerformanceError.message}`);

        // --- 11. Fetch Events for overlay ---
        console.log("[get-kpis] Fetching events for overlay...");
        // Fetch all events for the last 24 months, aligned with monthly performance chart
        const eventsFetchStartDate = new Date();
        eventsFetchStartDate.setFullYear(eventsFetchStartDate.getFullYear() - 2); // Go back 2 years for events
        const eventsFetchStartDateISO = eventsFetchStartDate.toISOString();

        const { data: eventsData, error: eventsError } = await supabase
            .from('events')
            .select('event_name, event_type, start_date, end_date')
            .gte('start_date', eventsFetchStartDateISO)
            .order('start_date', { ascending: true });
        
        if (eventsError) throw new Error(`Events query failed: ${eventsError.message}`);


        // --- Build response ---
        const kpis = {
            revenue: totalRevenue.toFixed(2),
            revenueChange: revenueChange.toFixed(2),
            totalExpenses: totalExpenses.toFixed(2),
            expensesChange: expensesChange.toFixed(2),
            totalGrossMargin: totalGrossMargin.toFixed(2),
            grossMarginChange: grossMarginChange.toFixed(2),
            totalOrders: totalOrders || 0,
            ordersChange: ordersChange.toFixed(2),
            newClients: newClients || 0,
            clientsChange: clientsChange.toFixed(2),
            avgOrderValue: avgOrderValue.toFixed(2),
            revenueData: revenueEvolutionData,
            orderTypeData: orderTypeDistribution,
            weekdayData: weekdayPerformance,
            topProductsData: topProductsData,
            expenseDistributionData: expenseDistributionData,
            monthlyPerformanceData: monthlyPerformance,
            eventsData: eventsData // Include events data
        };

        return new Response(JSON.stringify(kpis), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[get-kpis] FATAL ERROR:', error);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            details: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
