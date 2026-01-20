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

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
            status: 405,
            headers: { 'Allow': 'POST' }
        });
    }

    try {
        const data = await context.request.json();
        console.log('--- [DEBUG] Received data:', JSON.stringify(data, null, 2));

        const { recaptchaToken, ...formData } = data; // Extract recaptchaToken

        // 1. Verify reCAPTCHA token
        if (!recaptchaToken) {
            console.error('--- [ERROR] reCAPTCHA token missing');
            return new Response(JSON.stringify({ error: 'reCAPTCHA token missing.' }), { status: 400 });
        }

        const RECAPTCHA_SECRET_KEY = context.env.RECAPTCHA_SECRET_KEY;
        if (!RECAPTCHA_SECRET_KEY) {
            console.error('--- [ERROR] RECAPTCHA_SECRET_KEY is not set in environment variables');
            return new Response(JSON.stringify({ error: 'Server configuration error: reCAPTCHA secret key missing.' }), { status: 500 });
        }

        const recaptchaVerifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        });
        const recaptchaResult = await recaptchaVerifyResponse.json();

        console.log('--- [DEBUG] reCAPTCHA verification result:', recaptchaResult);

        if (!recaptchaResult.success || recaptchaResult.score < 0.5) { // Adjust score threshold as needed
            console.error('--- [ERROR] reCAPTCHA verification failed or score too low:', recaptchaResult);
            return new Response(JSON.stringify({ error: 'reCAPTCHA verification failed. Are you a robot?' }), { status: 403 });
        }

        // --- I18n Setup ---
        const lang = formData.lang && ['fr', 'en', 'zh'].includes(formData.lang) ? formData.lang : 'fr';
        const translations = { fr, en, zh };
        const t = (key) => {
            const keys = key.split('.');
            let result = translations[lang].translation;
            for (const k of keys) {
                result = result?.[k];
                if (!result) return key; // Return key if not found
            }
            return result;
        };

        // Continue with the rest of the logic using formData instead of data
        if (!formData.type || !formData.customer || !formData.requestDate) {
            console.error('--- [ERROR] Missing required base fields');
            return new Response(JSON.stringify({ error: 'Missing required base fields (type, customer, requestDate)' }), { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        let clientId = null;
        let entrepriseId = null;
        let customerDetailsForEmail = {};

        console.log(`--- [DEBUG] Customer Type: ${formData.customerType}`);

        if (formData.customerType === 'Particulier') {
            if (!formData.customer.email) {
                console.error('--- [ERROR] Missing customer email for Particulier');
                return new Response(JSON.stringify({ error: 'Missing customer email for Particulier type' }), { status: 400 });
            }
            
            console.log(`--- [DEBUG] Looking for client with email: ${formData.customer.email}`);
            let { data: client, error: fetchError } = await supabase
                .from('clients')
                .select('*')
                .eq('email', formData.customer.email)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            console.log('--- [DEBUG] Client fetch result:', client ? `Found client ID ${client.id}` : 'Client not found');

            if (!client) {
                const newId = generateClientId();
                console.log(`--- [DEBUG] Creating new client with generated ID: ${newId}`);
                const { data: newClient, error: insertError } = await supabase
                    .from('clients')
                    .insert({
                        email: formData.customer.email,
                        first_name: formData.customer.firstName || null,
                        last_name: formData.customer.lastName || null,
                        phone: formData.customer.phone || null,
                        client_id: newId,
                        type: 'Particulier' // Ajout du champ type
                    })
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                client = newClient;
                console.log('--- [DEBUG] New client created:', client);
            }
            clientId = client.id;
            customerDetailsForEmail = {
                type: 'Particulier',
                name: `${formData.customer.lastName || 'N/A'} ${formData.customer.firstName || ''}`,
                email: formData.customer.email,
                phone: formData.customer.phone || 'N/A',
                clientId: client.client_id
            };

        } else if (formData.customerType === 'Entreprise') {
            if (!formData.customer.companyName || !formData.customer.contactEmail) {
                console.error('--- [ERROR] Missing company name or contact email for Entreprise');
                return new Response(JSON.stringify({ error: 'Missing company name or contact email for Entreprise type' }), { status: 400 });
            }

            console.log(`--- [DEBUG] Looking for company with contact email: ${formData.customer.contactEmail}`);
            let { data: entreprise, error: fetchError } = await supabase
                .from('entreprises')
                .select('*')
                .eq('contact_email', formData.customer.contactEmail)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            console.log('--- [DEBUG] Entreprise fetch result:', entreprise ? `Found entreprise ID ${entreprise.id}` : 'Entreprise not found');

            if (!entreprise) {
                console.log('--- [DEBUG] Creating new entreprise');
                const { data: newEntreprise, error: insertError } = await supabase
                    .from('entreprises')
                    .insert({
                        nom_entreprise: formData.customer.companyName,
                        siret: formData.customer.siret || null,
                        contact_name: formData.customer.contactName || null,
                        contact_email: formData.customer.contactEmail,
                        contact_phone: formData.customer.contactPhone || null
                    })
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                entreprise = newEntreprise;
                console.log('--- [DEBUG] New entreprise created:', entreprise);
            }
            entrepriseId = entreprise.id;
            customerDetailsForEmail = {
                type: 'Entreprise',
                companyName: formData.customer.companyName,
                siret: formData.customer.siret || 'N/A',
                contactName: formData.customer.contactName || 'N/A',
                contactEmail: formData.customer.contactEmail,
                contactPhone: formData.customer.contactPhone || 'N/A'
            };
        } else {
            console.error(`--- [ERROR] Invalid customerType: ${formData.customerType}`);
            return new Response(JSON.stringify({ error: 'Invalid customerType' }), { status: 400 });
        }

        let details = {};
        if (formData.type === 'COMMANDE_MENU') {
            details = { formulaName: formData.formulaName, formulaOption: formData.formulaOption, deliveryCity: formData.deliveryCity };
        } else if (formData.type === 'RESERVATION_SERVICE') {
            details = { 
                customerType: formData.customerType,
                serviceType: formData.serviceType, 
                heure: formData.heure,
                numberOfPeople: formData.numberOfPeople,
                ville: formData.ville,
                budget: formData.budget,
                allergies: formData.allergies,
                customerMessage: formData.customerMessage 
            };
        } else if (formData.type === 'COMMANDE_SPECIALE') {
            details = {
                items: JSON.parse(formData.details),
                total: formData.total,
                deliveryCity: formData.deliveryCity
            };
        }

        const demandePayload = {
            client_id: clientId,
            entreprise_id: entrepriseId,
            type: formData.type,
            status: 'Nouvelle',
            request_date: formData.requestDate,
            details_json: details
        };
        
        const { data: newDemande, error: demandeError } = await supabase
            .from('demandes')
            .insert(demandePayload)
            .select()
            .single();

        if (demandeError) throw demandeError;
        console.log('--- [DEBUG] "demandes" insertion successful');

        // --- Préparation de l'e-mail ---
        const resendApiKey = context.env.RESEND_API_KEY;
        if (resendApiKey) {
            let detailsHtml = '<ul>';
            for (const [key, value] of Object.entries(details)) {
                if (value) {
                    const keyMap = {
                        customerType: 'Type de client',
                        serviceType: 'Type de service',
                        heure: 'Heure souhaitée',
                        numberOfPeople: 'Nombre de personnes',
                        ville: 'Ville',
                        budget: 'Budget par personne',
                        allergies: 'Allergies/Régimes',
                        customerMessage: 'Message du client',
                        formulaName: 'Formule',
                        formulaOption: 'Option de la formule',
                        deliveryCity: 'Ville de livraison'
                    };
                    detailsHtml += `<li><strong>${keyMap[key] || key}:</strong> ${value}</li>`;
                }
            }
            detailsHtml += '</ul>';

            let customerInfoHtml = '';
            if (customerDetailsForEmail.type === 'Particulier') {
                customerInfoHtml = `
                    <li><strong>Nom :</strong> ${customerDetailsForEmail.name}</li>
                    <li><strong>Email :</strong> ${customerDetailsForEmail.email}</li>
                    <li><strong>Téléphone :</strong> ${customerDetailsForEmail.phone}</li>
                    <li><strong>ID Client :</strong> ${customerDetailsForEmail.clientId}</li>
                `;
            } else if (customerDetailsForEmail.type === 'Entreprise') {
                customerInfoHtml = `
                    <li><strong>Nom de l'entreprise :</strong> ${customerDetailsForEmail.companyName}</li>
                    <li><strong>SIRET :</strong> ${customerDetailsForEmail.siret}</li>
                    <li><strong>Nom du contact :</strong> ${customerDetailsForEmail.contactName}</li>
                    <li><strong>Email du contact :</strong> ${customerDetailsForEmail.contactEmail}</li>
                    <li><strong>Téléphone du contact :</strong> ${customerDetailsForEmail.contactPhone}</li>
                `;
            }

            try {
                const resend = new Resend(resendApiKey);
                
                // Email to Admin
                await resend.emails.send({
                    from: 'reservation@asiacuisine.re',
                    to: 'contact@asiacuisine.re',
                    subject: `Nouvelle demande (${customerDetailsForEmail.type})`,
                    html: `
                        <h1>Nouvelle demande reçue</h1>
                        <p>Une nouvelle demande de type <strong>${formData.type}</strong> a été soumise par un <strong>${customerDetailsForEmail.type}</strong>.</p>
                        <h3>Détails du ${customerDetailsForEmail.type} :</h3>
                        <ul>
                            ${customerInfoHtml}
                        </ul>
                        <h3>Détails de la demande :</h3>
                        <p><strong>Date souhaitée :</strong> ${new Date(formData.requestDate).toLocaleDateString('fr-FR')}</p>
                        ${detailsHtml}
                    `
                });

                // --- Email to Client ---
                const clientEmail = customerDetailsForEmail.type === 'Particulier' ? customerDetailsForEmail.email : customerDetailsForEmail.contactEmail;
                const clientName = customerDetailsForEmail.type === 'Particulier' ? (customerDetailsForEmail.name || 'client(e)') : (customerDetailsForEmail.contactName || 'client(e)');
                const requestId = newDemande.id.substring(0, 8);
                const requestDate = new Date(formData.requestDate).toLocaleDateString(lang === 'zh' ? 'zh-CN' : lang, { year: 'numeric', month: 'long', day: 'numeric' });
                const trackingPageUrl = `https://www.asiacuisine.re/suivi.html?id=${requestId}`;
                
                const emailBody = `
                    <h2>${t('email.confirmation.title')}</h2>
                    <p>${t('email.confirmation.greeting').replace('${clientName}', clientName)}</p>
                    <p>${t('email.confirmation.body').replace('${requestId}', `<strong>${requestId}</strong>`).replace('${trackingPageUrl}', `<a href="${trackingPageUrl}">${t('email.confirmation.tracking_link_text')}</a>`)}</p>
                    <p>${t('email.confirmation.summary_title')}</p>
                    <ul>
                        <li><strong>${t('email.confirmation.request_type')}</strong> ${formData.type}</li>
                        <li><strong>${t('email.confirmation.request_date')}</strong> ${requestDate}</li>
                    </ul>
                    <p>${t('email.confirmation.questions')}</p>
                    <br>
                    <p>${t('email.confirmation.closing')}</p>
                    <p><strong>${t('email.confirmation.signature')}</strong></p>
                `;

                await resend.emails.send({
                    from: 'Asiacuisine.re <no-reply@asiacuisine.re>',
                    to: clientEmail,
                    subject: t('email.confirmation.subject'),
                    html: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                            ${emailBody}
                            ${getEmailFooter(t, lang)}
                        </div>
                    `
                });

            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
            }
        }

        return new Response(JSON.stringify({ message: 'Request received and processed successfully.' }), { status: 201 });

    } catch (error) {
        console.error('--- [FATAL ERROR] Error processing request:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
    }
}
