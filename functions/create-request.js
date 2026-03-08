import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function sendWhatsAppAlert(message) {
    const phone = process.env.ADMIN_WHATSAPP_NUMBER;
    const apiKey = process.env.ADMIN_WHATSAPP_API_KEY;
    if (!phone || !apiKey) return;
    try {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
        await fetch(url);
    } catch (err) { console.error("WhatsApp Alert Error:", err); }
}

async function sendPushNotification(title, body, url = "https://gestion.asiacuisine.re/") {
    try {
        await fetch(`${process.env.SUPABASE_URL}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
            body: JSON.stringify({ title, body, url })
        });
    } catch (e) { console.error("Push Alert Error:", e); }
}

export const handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { type, customerType, customer, requestDate, details_json, recaptchaToken, lang } = JSON.parse(event.body);

        // 1. Verify reCAPTCHA
        if (recaptchaToken) {
            const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;
            const recaptchaRes = await fetch(verifyUrl, { method: 'POST' });
            const recaptchaJson = await recaptchaRes.json();
            if (!recaptchaJson.success || recaptchaJson.score < 0.5) {
                console.error("reCAPTCHA failed:", recaptchaJson);
                return { statusCode: 403, headers, body: JSON.stringify({ error: 'Security verification failed' }) };
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

        // 3. Create Demand
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
            lang: lang || 'fr'
        }).select().single();

        if (dErr) throw dErr;

        // 4. Alerts
        const alertMsg = `🔔 *NOUVELLE DEMANDE (${type.replace('_',' ')})*\n\n👤 *Client:* ${clientName}\n📅 *Date:* ${requestDate || 'Non spécifiée'}\n📍 *Ville:* ${details_json.ville || details_json.deliveryCity || 'Non spécifiée'}`;
        
        await sendWhatsAppAlert(`${alertMsg}\n\n👉 *Gérer:* https://gestion.asiacuisine.re`);
        await sendPushNotification("🔔 Nouvelle Demande !", `Dossier de ${clientName} reçu (${type.replace('_',' ')})`);

        return { statusCode: 200, headers, body: JSON.stringify({ message: 'Request created successfully', id: demandData.id }) };

    } catch (error) {
        console.error("Error creating request:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
