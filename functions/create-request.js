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

// Helper to send WhatsApp notification via CallMeBot (Admin Alert)
async function sendWhatsAppAdminAlert(context, message) {
  const phone = context.env.ADMIN_WHATSAPP_NUMBER; 
  const apiKey = context.env.ADMIN_WHATSAPP_API_KEY;
  if (!phone || !apiKey) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    await fetch(url);
  } catch (err) { console.error("[WhatsApp Alert Error]", err); }
}

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {  
            status: 405,
            headers: { 'Allow': 'POST' }
        });
    }

    try {
        const data = await context.request.json();
        const { recaptchaToken, ...formData } = data; 

        // 1. Verify reCAPTCHA token
        if (!recaptchaToken) {
            return new Response(JSON.stringify({ error: 'reCAPTCHA token missing.' }), { status: 400 });
        }

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

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);   

        // 2. Manage Client / Entreprise logic
        let clientId = null;
        let entrepriseId = null;
        let customerName = "";

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
            customerName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
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
            customerName = entreprise.nom_entreprise;
        }

        // 3. Prepare Details
        let details = {};
        if (formData.type === 'COMMANDE_MENU') {
            details = { formulaName: formData.formulaName, formulaOption: formData.formulaOption, deliveryCity: formData.deliveryCity };
        } else if (formData.type === 'RESERVATION_SERVICE') {
            details = { serviceType: formData.serviceType, heure: formData.heure, numberOfPeople: formData.numberOfPeople, ville: formData.ville, customerMessage: formData.customerMessage };
        } else if (formData.type === 'COMMANDE_SPECIALE') {
            details = { items: JSON.parse(formData.details || '[]'), total: formData.total, deliveryCity: formData.deliveryCity };
        }

        // 4. Create Demand with "Intention WhatsApp" status
        // WE DO NOT SEND EMAIL TO CLIENT HERE AS REQUESTED.
        const { data: newDemande, error: demandeError } = await supabase
            .from('demandes')
            .insert({
                client_id: clientId,
                entreprise_id: entrepriseId,
                type: formData.type,
                status: 'Intention WhatsApp', 
                request_date: formData.requestDate,
                details_json: details,
                total_amount: formData.total || null,
                business_unit: 'cuisine'
            })
            .select()
            .single();

        if (demandeError) throw demandeError;

        // 5. Notification Email Admin (Keeping it for records)
        const resendApiKey = context.env.RESEND_API_KEY;
        if (resendApiKey) {
            try {
                const resend = new Resend(resendApiKey);
                await resend.emails.send({
                    from: 'reservation@asiacuisine.re',
                    to: 'contact@asiacuisine.re',
                    subject: `[INTENTION] Nouvelle demande (${formData.type})`,
                    html: `<h1>Intention de commande reçue</h1>
                           <p><strong>Client:</strong> ${customerName}</p>
                           <p><strong>Type:</strong> ${formData.type}</p>
                           <p><strong>Date:</strong> ${new Date(formData.requestDate).toLocaleDateString('fr-FR')}</p>
                           <p><em>Note: Cette demande est en attente du message WhatsApp client.</em></p>`
                });
            } catch (e) { console.error("Admin Email Error:", e); }
        }

        // 6. WhatsApp Alert to Admin
        const waMessage = `🛎️ *INTENTION DE COMMANDE*\n\n👤 *Client:* ${customerName}\n📅 *Date:* ${new Date(formData.requestDate).toLocaleDateString('fr-FR')}\n📍 *Ville:* ${details.ville || details.deliveryCity || '—'}\n\n_Le client a été redirigé vers son WhatsApp pour vous envoyer son message._`;
        await sendWhatsAppAdminAlert(context, waMessage);

        return new Response(JSON.stringify({ message: 'Draft created', id: newDemande.id }), { 
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[FATAL ERROR]', error);
        return new Response(JSON.stringify({ error: 'Internal Error', details: error.message }), { status: 500 });
    }
}