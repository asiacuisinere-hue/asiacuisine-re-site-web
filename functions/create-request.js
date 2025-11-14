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
        console.log('--- [DEBUG] Received data:', JSON.stringify(data, null, 2));

        if (!data.type || !data.customer || !data.requestDate) {
            console.error('--- [ERROR] Missing required base fields');
            return new Response(JSON.stringify({ error: 'Missing required base fields (type, customer, requestDate)' }), { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        let clientId = null;
        let entrepriseId = null;
        let customerDetailsForEmail = {};

        console.log(`--- [DEBUG] Customer Type: ${data.customerType}`);

        if (data.customerType === 'Particulier') {
            if (!data.customer.email) {
                console.error('--- [ERROR] Missing customer email for Particulier');
                return new Response(JSON.stringify({ error: 'Missing customer email for Particulier type' }), { status: 400 });
            }
            
            console.log(`--- [DEBUG] Looking for client with email: ${data.customer.email}`);
            let { data: client, error: fetchError } = await supabase
                .from('clients')
                .select('*')
                .eq('email', data.customer.email)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            console.log('--- [DEBUG] Client fetch result:', client ? `Found client ID ${client.id}` : 'Client not found');

            if (!client) {
                const newId = generateClientId();
                console.log(`--- [DEBUG] Creating new client with generated ID: ${newId}`);
                const { data: newClient, error: insertError } = await supabase
                    .from('clients')
                    .insert({
                        email: data.customer.email,
                        first_name: data.customer.firstName || null,
                        last_name: data.customer.lastName || null,
                        phone: data.customer.phone || null,
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
                name: `${data.customer.lastName || 'N/A'} ${data.customer.firstName || ''}`,
                email: data.customer.email,
                phone: data.customer.phone || 'N/A',
                clientId: client.client_id
            };

        } else if (data.customerType === 'Entreprise') {
            if (!data.customer.companyName || !data.customer.contactEmail) {
                console.error('--- [ERROR] Missing company name or contact email for Entreprise');
                return new Response(JSON.stringify({ error: 'Missing company name or contact email for Entreprise type' }), { status: 400 });
            }

            console.log(`--- [DEBUG] Looking for company with contact email: ${data.customer.contactEmail}`);
            let { data: entreprise, error: fetchError } = await supabase
                .from('entreprises')
                .select('*')
                .eq('contact_email', data.customer.contactEmail)
                .single();

            if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
            console.log('--- [DEBUG] Entreprise fetch result:', entreprise ? `Found entreprise ID ${entreprise.id}` : 'Entreprise not found');

            if (!entreprise) {
                console.log('--- [DEBUG] Creating new entreprise');
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
                console.log('--- [DEBUG] New entreprise created:', entreprise);
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
            console.error(`--- [ERROR] Invalid customerType: ${data.customerType}`);
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

        const demandePayload = {
            client_id: clientId,
            entreprise_id: entrepriseId,
            type: data.type,
            status: 'Nouvelle',
            request_date: data.requestDate,
            details_json: details
        };
        console.log('--- [DEBUG] Payload for "demandes" insertion:', JSON.stringify(demandePayload, null, 2));

        const { error: demandeError } = await supabase
            .from('demandes')
            .insert(demandePayload);

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
        console.error('--- [FATAL ERROR] Error processing request:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
    }
}
