import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fr from '../locales/fr.json' assert { type: 'json' };
import en from '../locales/en.json' assert { type: 'json' };
import zh from '../locales/zh.json' assert { type: 'json' };

// Helper function to generate a random 6-character alphanumeric string
function generateClientId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

const getEmailFooter = (t, lang) => {
    const baseUrl = 'https://www.asiacuisine.re';
    const tagline = t('email.footer.tagline');
    return `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eeeeee; text-align: center; color: #888888; font-size: 12px;">
            <img src="${baseUrl}/favicon.png" alt="Asiacuisine.re Logo" width="50" height="50" style="margin-bottom: 10px;">
            <p style="margin: 0;"><strong>Asiacuisine.re</strong></p>
            <p style="margin: 0;">${tagline}</p>
            <p style="margin: 10px 0 0 0;">
                <a href="${baseUrl}?lang=${lang}" style="color: #888888; text-decoration: none;">Site Web</a> |
                <a href="https://www.instagram.com/asiacuisine.re/" style="color: #888888; text-decoration: none;">Instagram</a> |
                <a href="https://www.facebook.com/profile.php?id=100090025515349" style="color: #888888; text-decoration: none;">Facebook</a>
            </p>
        </div>
    `;
};

async function sendWhatsAppAdminAlert(context, message) {
  const phone = context.env.ADMIN_WHATSAPP_NUMBER; 
  const apiKey = context.env.ADMIN_WHATSAPP_API_KEY;
  if (!phone || !apiKey) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    await fetch(url);
  } catch (err) { console.error(err); }
}

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405 });
    }

    try {
        const data = await context.request.json();
        const { recaptchaToken, ...formData } = data; 

        // 1. reCAPTCHA Verification
        const RECAPTCHA_SECRET_KEY = context.env.RECAPTCHA_SECRET_KEY;
        const recaptchaVerifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {  
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        });
        const recaptchaResult = await recaptchaVerifyResponse.json();
        if (!recaptchaResult.success || recaptchaResult.score < 0.5) {
            return new Response(JSON.stringify({ error: 'reCAPTCHA verification failed.' }), { status: 403 });
        }

        // 2. I18n Setup
        const lang = formData.lang && ['fr', 'en', 'zh'].includes(formData.lang) ? formData.lang : 'fr';  
        const translations = { fr, en, zh };
        const t = (key) => {
            const keys = key.split('.');
            let result = translations[lang].translation;
            for (const k of keys) { result = result?.[k]; if (!result) return key; }
            return result;
        };

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 3. Client / Entreprise Logic
        let clientId = null;
        let entrepriseId = null;
        let customerName = "";
        let clientEmail = "";

        if (formData.customerType === 'Particulier') {
            let { data: client } = await supabase.from('clients').select('*').eq('email', formData.customer.email).single();
            if (!client) {
                const { data: newClient } = await supabase.from('clients').insert({
                    email: formData.customer.email,
                    first_name: formData.customer.firstName || null,
                    last_name: formData.customer.lastName || null,
                    phone: formData.customer.phone || null,
                    client_id: generateClientId(),
                    type: 'Particulier'
                }).select().single();
                client = newClient;
            }
            clientId = client.id;
            customerName = `${formData.customer.firstName || ''} ${formData.customer.lastName || ''}`.trim();
            clientEmail = formData.customer.email;
        } else {
            let { data: entreprise } = await supabase.from('entreprises').select('*').eq('contact_email', formData.customer.contactEmail).single();
            if (!entreprise) {
                const { data: newEntreprise } = await supabase.from('entreprises').insert({
                    nom_entreprise: formData.customer.companyName,
                    siret: formData.customer.siret || null,
                    contact_name: formData.customer.contactName || null,
                    contact_email: formData.customer.contactEmail,
                    contact_phone: formData.customer.contactPhone || null
                }).select().single();
                entreprise = newEntreprise;
            }
            entrepriseId = entreprise.id;
            customerName = formData.customer.companyName;
            clientEmail = formData.customer.contactEmail;
        }

        // 4. Details & Price Defaults
        let details = {};
        if (formData.type === 'COMMANDE_MENU') {
            details = { formulaName: formData.formulaName, formulaOption: formData.formulaOption, deliveryCity: formData.deliveryCity };
        } else if (formData.type === 'RESERVATION_SERVICE') {
            details = { serviceType: formData.serviceType, heure: formData.heure, numberOfPeople: formData.numberOfPeople, ville: formData.ville, customerMessage: formData.customerMessage };
        } else if (formData.type === 'COMMANDE_SPECIALE') {
            details = { items: JSON.parse(formData.details || '[]'), total: formData.total, deliveryCity: formData.deliveryCity };
        }

        const { data: newDemande, error: demandeError } = await supabase
            .from('demandes')
            .insert({
                client_id: clientId,
                entreprise_id: entrepriseId,
                type: formData.type,
                status: 'En attente de traitement',
                request_date: formData.requestDate,
                details_json: details,
                total_amount: formData.total || null,
                business_unit: 'cuisine'
            })
            .select()
            .single();

        if (demandeError) throw demandeError;

        // 5. EMAILS (Admin & Client)
        const resendApiKey = context.env.RESEND_API_KEY;
        if (resendApiKey) {
            const resend = new Resend(resendApiKey);
            // Email to Admin
            await resend.emails.send({
                from: 'reservation@asiacuisine.re',
                to: 'contact@asiacuisine.re',
                subject: `Nouvelle demande (${formData.type})`,
                html: `<h1>Nouvelle demande reçue</h1><p>Client: ${customerName}</p><p>Type: ${formData.type}</p>`
            });

            // Email to Client
            const requestIdShort = newDemande.id.substring(0, 8);
            const trackingPageUrl = `https://www.asiacuisine.re/suivi.html?id=${requestIdShort}`;
            await resend.emails.send({
                from: 'Asiacuisine.re <no-reply@asiacuisine.re>',
                to: clientEmail,
                subject: t('email.confirmation.subject'),
                html: `<div style="font-family: Arial;"><h2>${t('email.confirmation.title')}</h2><p>${t('email.confirmation.body').replace('${requestId}', requestIdShort).replace('${trackingPageUrl}', `<a href="${trackingPageUrl}">${t('email.confirmation.tracking_link_text')}</a>`)}</p>${getEmailFooter(t, lang)}</div>`
            });
        }

        // 6. WhatsApp to Admin
        const waMessage = `⚠️ *NOUVELLE DEMANDE (${formData.type})*\n\n👤 *Client:* ${customerName}\n📅 *Date:* ${new Date(formData.requestDate).toLocaleDateString('fr-FR')}\n📍 *Ville:* ${details.ville || details.deliveryCity || '—'}\n\n_Veuillez valider la logistique et le prix dans votre Dashboard._`;
        await sendWhatsAppAdminAlert(context, waMessage);

        return new Response(JSON.stringify({ message: 'Success', id: newDemande.id }), { status: 201 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}