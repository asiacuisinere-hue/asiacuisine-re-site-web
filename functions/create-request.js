import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function sendWhatsAppAlert(message, env) {
    const phone = env.ADMIN_WHATSAPP_NUMBER;
    const apiKey = env.ADMIN_WHATSAPP_API_KEY;
    if (!phone || !apiKey) return;
    try {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
        await fetch(url);
    } catch (err) { console.error("WhatsApp Alert Error:", err); }
}

async function sendPushNotification(title, body, env, url = "https://gestion.asiacuisine.re/") {
    try {
        await fetch(`${env.SUPABASE_URL}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ title, body, url })
        });
    } catch (e) { console.error("Push Alert Error:", e); }
}

export async function onRequest(context) {
    const { request, env } = context;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${request.method} Not Allowed` }), {
            status: 405,
            headers: { ...corsHeaders, 'Allow': 'POST', 'Content-Type': 'application/json' }
        });
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        const body = await request.json();
        const { type, customerType, customer, requestDate, details_json, recaptchaToken, lang, pushSubscription } = body;

        // 1. Verify reCAPTCHA
        if (recaptchaToken) {
            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;
            const recaptchaRes = await fetch(verifyUrl, { method: 'POST' });
            const recaptchaJson = await recaptchaRes.json();
            
            if (!recaptchaJson.success || recaptchaJson.score < 0.5) {
                console.error("reCAPTCHA Verification Failed:", recaptchaJson);
                return new Response(JSON.stringify({ 
                    error: 'Security verification failed', 
                    details: recaptchaJson['error-codes'] || 'Low score' 
                }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }
        }

        // 2. Handle Client/Entreprise
        let client_id = null;
        let entreprise_id = null;
        let clientName = "Client";

        if (customerType === 'Particulier') {
            const { data: client, error: cErr } = await supabase.from('clients').upsert({
                last_name: customer.lastName,
                first_name: customer.firstName || '',
                email: customer.email,
                phone: customer.phone,
                type: 'Particulier',
                updated_at: new Date().toISOString()
            }, { onConflict: 'email' }).select().single();
            if (cErr) throw cErr;
            client_id = client.id;
            clientName = `${client.first_name} ${client.last_name}`;
        } else {
            const { data: ent, error: eErr } = await supabase.from('entreprises').upsert({
                nom_entreprise: customer.companyName,
                siret: customer.siret,
                contact_name: customer.contactName,
                contact_email: customer.contactEmail,
                contact_phone: customer.contactPhone,
                updated_at: new Date().toISOString()
            }, { onConflict: 'contact_email' }).select().single();
            if (eErr) throw eErr;
            entreprise_id = ent.id;
            clientName = ent.nom_entreprise;
        }

        // 3. Register push subscription if provided
        let push_subscription_id = null;
        if (pushSubscription) {
            try {
                const { data: ps, error: psErr } = await supabase
                    .from('push_subscriptions')
                    .insert({
                        subscription: pushSubscription,
                        user_agent: request.headers.get('user-agent') || 'unknown',
                        role: 'customer'
                    })
                    .select('id')
                    .single();
                if (!psErr && ps) push_subscription_id = ps.id;
            } catch (e) { console.error('Error saving push subscription:', e); }
        }

        // 4. Create Demand
        const status = (type === 'COMMANDE_MENU' || type === 'COMMANDE_SPECIALE') ? 'Intention WhatsApp' : 'Nouvelle';
        const business_unit = (type === 'RESERVATION_SERVICE' || type === 'COMMANDE_MENU' || type === 'COMMANDE_SPECIALE') ? 'cuisine' : 'courtage';

        const { data: demandData, error: dErr } = await supabase.from('demandes').insert({
            type,
            client_id,
            entreprise_id,
            request_date: requestDate,
            details_json,
            status,
            business_unit,
            lang: lang || 'fr',
            push_subscription_id
        }).select().single();

        if (dErr) throw dErr;

        // 5. Alerts
        const isBusinessMeal = details_json.serviceType === 'repas-affaires';
        const businessTag = isBusinessMeal ? '💼 *REPAS AFFAIRES*' : '🔔 *NOUVELLE DEMANDE*';
        const alertMsg = `${businessTag} (${type.replace('_',' ')})\n\n👤 *Client:* ${clientName}\n📅 *Date:* ${requestDate || 'Non spécifiée'}\n📍 *Ville:* ${details_json.ville || details_json.deliveryCity || 'Non spécifiée'}`;
        
        await sendWhatsAppAlert(`${alertMsg}\n\n👉 *Gérer:* https://gestion.asiacuisine.re`, env);
        await sendPushNotification("🔔 Nouvelle Demande !", `Dossier de ${clientName} reçu (${type.replace('_',' ')})`, env);

        return new Response(JSON.stringify({ message: 'Request created successfully', id: demandData.id }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("Error creating request:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
