import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Embedded Translations (Simplified for internal needs)
const translations = {
    fr: { translation: { email: { footer: { tagline: "Chef privé à La Réunion" } } } }
};

const t = (lang, key) => {
    return translations[lang]?.translation.email.footer.tagline || "Asiacuisine.re";
};

const getEmailFooter = (t_func, lang) => {
    return `<div style="margin-top: 30px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px;">Asiacuisine.re</div>`;
};

const formatDateToISOString = (date) => {
    return date.toISOString().split('T')[0];
};

async function runJob(env) {
    console.log('--- [CRON] Starting automation tasks...');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const resend = new Resend(env.RESEND_API_KEY);
    const today = new Date();
    const todayISO = formatDateToISOString(today);

    // --- Task 4: Automated Recurring Expenses (Credits) ---
    try {
        console.log('[CRON] Checking recurring expenses...');
        // Find recurring expenses that haven't expired and aren't yet created for this month
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        const { data: recurringList } = await supabase
            .from('expenses')
            .select('*')
            .eq('is_recurring', true)
            .gte('end_date', todayISO);

        for (const exp of (recurringList || [])) {
            // Check if already created for this month (avoid duplicates)
            const { count } = await supabase
                .from('expenses')
                .select('*', { count: 'exact', head: true })
                .eq('description', exp.description)
                .eq('amount', exp.amount)
                .gte('expense_date', currentMonthStart);

            if (count === 0) {
                const newDate = new Date(today.getFullYear(), today.getMonth(), new Date(exp.expense_date).getDate());
                await supabase.from('expenses').insert({
                    description: exp.description,
                    amount: exp.amount,
                    category: exp.category,
                    business_unit: exp.business_unit,
                    expense_date: formatDateToISOString(newDate),
                    is_recurring: false // The child entry is just a normal expense
                });
                console.log(`[CRON] Auto-added recurring expense: ${exp.description}`);
            }
        }
    } catch (e) { console.error("Error in Recurring Expenses:", e); }

    // --- Task 5: Automated Subscription Renewals ---
    try {
        console.log('[CRON] Checking subscription renewals...');
        const { data: dueSubs } = await supabase
            .from('abonnements')
            .select('*')
            .eq('status', 'actif')
            .lte('next_billing_date', todayISO);

        for (const sub of (dueSubs || [])) {
            // 1. Generate Invoice (via Edge Function)
            console.log(`[CRON] Renewing subscription: ${sub.id}`);
            const renewRes = await fetch(`${env.SUPABASE_URL}/functions/v1/generate-recurring-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
                body: JSON.stringify({ abonnementId: sub.id })
            });

            if (renewRes.ok) {
                // 2. Update next_billing_date (+1 month)
                const nextDate = new Date(sub.next_billing_date);
                nextDate.setMonth(nextDate.getMonth() + 1);
                
                // If end_date reached, close subscription
                let newStatus = sub.status;
                if (sub.end_date && new Date(sub.end_date) < nextDate) {
                    newStatus = 'termine';
                }

                await supabase.from('abonnements')
                    .update({ 
                        next_billing_date: formatDateToISOString(nextDate),
                        status: newStatus
                    })
                    .eq('id', sub.id);
                
                console.log(`[CRON] Subscription ${sub.id} renewed to ${formatDateToISOString(nextDate)}`);
            } else {
                console.error(`[CRON] Failed to generate invoice for sub ${sub.id}`);
            }
        }
    } catch (e) { console.error("Error in Subscriptions:", e); }

    console.log('--- [CRON] Tasks finished.');
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        if (url.pathname === '/trigger-cron') {
            await runJob(env);
            return new Response('OK', { status: 200 });
        }
        return new Response('Worker running.', { status: 200 });
    },
    async scheduled(event, env, ctx) {
        await runJob(env);
    },
};
