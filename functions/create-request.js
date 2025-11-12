import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Helper function to generate a random 6-character alphanumeric string
function generateClientId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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

        if (!data.type || !data.customer || !data.requestDate) {
            return new Response(JSON.stringify({ error: 'Missing required base fields (type, customer, requestDate)' }), { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        let clientId = null;
        let entrepriseId = null;
        let customerDetailsForEmail = {}; // To store details for the email

        if (data.customerType === 'Particulier') {
            if (!data.customer.email) {
                return new Response(JSON.stringify({ error: 'Missing customer email for Particulier type' }), { status: 400 });
            }
            // 1. Essayer de récupérer le client existant
            let { data: client, error: fetchError } = await supabase
                .from('clients')
                .select('*')
                .eq('email', data.customer.email)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found, ce qui est normal
                throw fetchError;
            }

            // 2. Si le client n'existe pas, le créer avec un nouvel ID
            if (!client) {
                const newId = generateClientId();
                const { data: newClient, error: insertError } = await supabase
                    .from('clients')
                    .insert({
                        email: data.customer.email,
                        first_name: data.customer.firstName || null,
                        last_name: data.customer.lastName || null,
                        phone: data.customer.phone || null,
                        client_id: newId
                    })
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                client = newClient;
            }
            clientId = client.id;
            customerDetailsForEmail = {
                type: 'Particulier',
                name: `${data.customer.lastName || 'N/A'} ${data.customer.firstName || ''}`,
                email: data.customer.email,
                phone: data.customer.phone || 'N/A',
                clientId: client.client_id
            };

        } else if (data.customerType === 'Entreprise') {
            if (!data.customer.companyName || !data.customer.contactEmail) {
                return new Response(JSON.stringify({ error: 'Missing company name or contact email for Entreprise type' }), { status: 400 });
            }
            // 1. Essayer de récupérer l'entreprise existante
            let { data: entreprise, error: fetchError } = await supabase
                .from('entreprises')
                .select('*')
                .eq('contact_email', data.customer.contactEmail) // Use email for lookup
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') {
                throw fetchError;
            }

            // 2. Si l'entreprise n'existe pas, la créer
            if (!entreprise) {
                const { data: newEntreprise, error: insertError } = await supabase
                    .from('entreprises')
                    .insert({
                        nom_entreprise: data.customer.companyName,
                        siret: data.customer.siret || null,
                        contact_name: data.customer.contactName || null,
                        contact_email: data.customer.contactEmail,
                        contact_phone: data.customer.contactPhone || null
                    })
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                entreprise = newEntreprise;
            }
            entrepriseId = entreprise.id;
            customerDetailsForEmail = {
                type: 'Entreprise',
                companyName: data.customer.companyName,
                siret: data.customer.siret || 'N/A',
                contactName: data.customer.contactName || 'N/A',
                contactEmail: data.customer.contactEmail,
                contactPhone: data.customer.contactPhone || 'N/A'
            };
        } else {
            return new Response(JSON.stringify({ error: 'Invalid customerType' }), { status: 400 });
        }

        let details = {};
        if (data.type === 'COMMANDE_MENU') {
            details = { formulaName: data.formulaName, formulaOption: data.formulaOption, deliveryCity: data.deliveryCity };
        } else if (data.type === 'RESERVATION_SERVICE') {
            details = { 
                customerType: data.customerType,
                serviceType: data.serviceType, 
                numberOfPeople: data.numberOfPeople, 
                customerMessage: data.customerMessage 
            };
        }

        const { error: demandeError } = await supabase
            .from('demandes')
            .insert({
                client_id: clientId, // Will be null for Entreprise
                entreprise_id: entrepriseId, // Will be null for Particulier
                type: data.type,
                status: 'Nouvelle',
                request_date: data.requestDate,
                details_json: details
            });

        if (demandeError) throw demandeError;

        // --- Préparation de l'e-mail ---
        const resendApiKey = context.env.RESEND_API_KEY;
        if (resendApiKey) {
            let detailsHtml = '<ul>';
            for (const [key, value] of Object.entries(details)) {
                if (value) {
                    const keyMap = {
                        customerType: 'Type de client',
                        serviceType: 'Type de service',
                        numberOfPeople: 'Nombre de personnes',
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
                await resend.emails.send({
                    from: 'reservation@asiacuisine.re',
                    to: 'contact@asiacuisine.re',
                    subject: `Nouvelle demande (${customerDetailsForEmail.type})`,
                    html: `
                        <h1>Nouvelle demande reçue</h1>
                        <p>Une nouvelle demande de type <strong>${data.type}</strong> a été soumise par un <strong>${customerDetailsForEmail.type}</strong>.</p>
                        <h3>Détails du ${customerDetailsForEmail.type} :</h3>
                        <ul>
                            ${customerInfoHtml}
                        </ul>
                        <h3>Détails de la demande :</h3>
                        <p><strong>Date souhaitée :</strong> ${new Date(data.requestDate).toLocaleDateString('fr-FR')}</p>
                        ${detailsHtml}
                    `
                });
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
            }
        }

        return new Response(JSON.stringify({ message: 'Request received and processed successfully.' }), { status: 201 });

    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
    }
}