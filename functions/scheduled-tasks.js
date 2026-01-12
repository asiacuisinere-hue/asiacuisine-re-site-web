import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fr from '../locales/fr.json' assert { type: 'json' };
import en from '../locales/en.json' assert { type: 'json' };
import zh from '../locales/zh.json' assert { type: 'json' };

const translations = { fr, en, zh };
const t = (lang, key) => {
    const keys = key.split('.');
    let result = translations[lang]?.translation; // Use optional chaining
    for (const k of keys) {
        result = result?.[k]; // Use optional chaining
        if (!result) return key; // Return key if not found
    }
    return result;
};

// Helper to format date for SQL
const formatDateToISOString = (date) => {
    return date.toISOString().split('T')[0];
};

export async function onRequest(context) {
    // This function is expected to be triggered by a Cloudflare Cron Trigger.
    // We assume the cron trigger sends a POST request.
    if (context.request.method !== 'POST') {
        return new Response('This function is designed to be triggered by a POST request from a Cron job.', { status: 405 });
    }

    console.log('--- [DEBUG] Scheduled tasks function triggered.');

    const resendApiKey = context.env.RESEND_API_KEY;
    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

    if (!resendApiKey || !supabase) {
        console.error('Environment variables for Resend or Supabase are not set.');
        return new Response('Server configuration error.', { status: 500 });
    }

    const resend = new Resend(resendApiKey);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // --- Task 1: Send Pre-Service Reminders ---
    try {
        const twoDaysFromNow = new Date(today);
        twoDaysFromNow.setDate(today.getDate() + 2);
        const twoDaysFromNowISO = formatDateToISOString(twoDaysFromNow);

        const { data: reminderDemands, error: reminderError } = await supabase
            .from('demandes')
            .select('id, request_date, type, details_json, clients ( email, first_name, last_name ), entreprises ( contact_email, contact_name )')
            .eq('type', 'RESERVATION_SERVICE')
            .eq('status', 'confirmed')
            .eq('request_date', twoDaysFromNowISO)
            .is('reminder_sent', null);

        if (reminderError) throw reminderError;

        console.log(`Found ${reminderDemands.length} demands for reminders on ${twoDaysFromNowISO}`);

        for (const demand of reminderDemands) {
            const clientEmail = demand.clients?.email || demand.entreprises?.contact_email;
            const clientName = (demand.clients ? `${demand.clients.first_name || ''} ${demand.clients.last_name || ''}` : (demand.entreprises?.contact_name || '')).trim();
            const clientLang = demand.details_json?.lang || 'fr';
            const formattedRequestDate = new Date(demand.request_date).toLocaleDateString(clientLang === 'zh' ? 'zh-CN' : clientLang, { year: 'numeric', month: 'long', day: 'numeric' });

            if (!clientEmail) continue;

            await resend.emails.send({
                from: 'no-reply@asiacuisine.re',
                to: clientEmail,
                subject: t(clientLang, 'email.reminder.subject'),
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                        <h2>${t(clientLang, 'email.reminder.title')}</h2>
                        <p>${t(clientLang, 'email.reminder.greeting').replace('${clientName}', clientName)}</p>
                        <p>${t(clientLang, 'email.reminder.body').replace('${requestDate}', `<strong>${formattedRequestDate}</strong>`)}</p>
                        <p><strong>${t(clientLang, 'email.reminder.summary_title')}</strong></p>
                        <ul>
                            <li><strong>${t(clientLang, 'email.reminder.request_type')}</strong> ${demand.details_json?.serviceType || demand.type}</li>
                        </ul>
                        <p>${t(clientLang, 'email.reminder.questions')}</p>
                        <br>
                        <p>${t(clientLang, 'email.reminder.closing')}</p>
                        <p><strong>${t(clientLang, 'email.reminder.signature')}</strong></p>
                    </div>
                `
            });

            await supabase.from('demandes').update({ reminder_sent: true }).eq('id', demand.id);
            console.log(`Reminder sent and marked for demand ID ${demand.id}`);
        }
    } catch (error) {
        console.error('Error processing pre-service reminders:', error);
    }

    // --- Task 2: Send Post-Service Follow-ups ---
    try {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayISO = formatDateToISOString(yesterday);

        const { data: followupDemands, error: followupError } = await supabase
            .from('demandes')
            .select('id, request_date, type, details_json, clients ( email, first_name, last_name ), entreprises ( contact_email, contact_name )')
            .eq('type', 'RESERVATION_SERVICE')
            .eq('status', 'completed')
            .eq('request_date', yesterdayISO)
            .is('followup_sent', null);

        if (followupError) throw followupError;

        console.log(`Found ${followupDemands.length} demands for follow-up on ${yesterdayISO}`);

        for (const demand of followupDemands) {
            const clientEmail = demand.clients?.email || demand.entreprises?.contact_email;
            const clientName = (demand.clients ? `${demand.clients.first_name || ''} ${demand.clients.last_name || ''}` : (demand.entreprises?.contact_name || '')).trim();
            const clientLang = demand.details_json?.lang || 'fr';
            const formattedRequestDate = new Date(demand.request_date).toLocaleDateString(clientLang === 'zh' ? 'zh-CN' : clientLang, { year: 'numeric', month: 'long', day: 'numeric' });

            if (!clientEmail) continue;

            await resend.emails.send({
                from: 'no-reply@asiacuisine.re',
                to: clientEmail,
                subject: t(clientLang, 'email.followup.subject'),
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                        <h2>${t(clientLang, 'email.followup.title')}</h2>
                        <p>${t(clientLang, 'email.followup.greeting').replace('${clientName}', clientName)}</p>
                        <p>${t(clientLang, 'email.followup.body').replace('${requestDate}', `<strong>${formattedRequestDate}</strong>`)}</p>
                        <p>${t(clientLang, 'email.followup.feedback_prompt')}</p>
                        <br>
                        <p>${t(clientLang, 'email.followup.closing')}</p>
                        <p><strong>${t(clientLang, 'email.followup.signature')}</strong></p>
                    </div>
                `
            });

            await supabase.from('demandes').update({ followup_sent: true }).eq('id', demand.id);
            console.log(`Follow-up sent and marked for demand ID ${demand.id}`);
        }
    } catch (error) {
        console.error('Error processing post-service follow-ups:', error);
    }

    return new Response('Scheduled tasks processed.', { status: 200 });
}
