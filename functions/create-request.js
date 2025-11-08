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

        if (!data.type || !data.customer || !data.customer.email || !data.requestDate) {
            return new Response(JSON.stringify({ error: 'Missing required base fields (type, customer.email, requestDate)' }), { status: 400 });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // --- Logique de création/récupération du client modifiée ---

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
                    type: data.customer.type || 'Particulier',
                    company_name: data.customer.companyName || null,
                    siret: data.customer.siret || null,
                    address: data.customer.address || null,
                    client_id: newId // <-- Ajout de l'identifiant unique
                })
                .select()
                .single();
            
            if (insertError) throw insertError;
            client = newClient;
        }

        // --- Fin de la logique modifiée ---

        let details = {};
        if (data.type === 'COMMANDE_MENU') {
            details = { formulaName: data.formulaName, formulaOption: data.formulaOption, deliveryCity: data.deliveryCity };
        } else if (data.type === 'RESERVATION_SERVICE') {
            details = { serviceType: data.serviceType, numberOfPeople: data.numberOfPeople, customerMessage: data.customerMessage };
        }

        const { error: demandeError } = await supabase
            .from('demandes')
            .insert({
                client_id: client.id,
                type: data.type,
                status: 'Nouvelle',
                request_date: data.requestDate,
                details_json: details
            });

        if (demandeError) throw demandeError;

        const resendApiKey = context.env.RESEND_API_KEY;
        if (resendApiKey) {
            try {
                const resend = new Resend(resendApiKey);
                await resend.emails.send({
                    from: 'reservation@asiacuisine.re',
                    to: 'contact@asiacuisine.re',
                    subject: `Nouvelle demande - ${data.type}`,
                    html: `
                        <h1>Nouvelle demande reçue</h1>
                        <p>Une nouvelle demande de type <strong>${data.type}</strong> a été soumise.</p>
                        <h3>Détails du client :</h3>
                        <ul>
                            <li><strong>Nom :</strong> ${data.customer.lastName || 'N/A'} ${data.customer.firstName || ''}</li>
                            <li><strong>Email :</strong> ${data.customer.email}</li>
                            <li><strong>Téléphone :</strong> ${data.customer.phone || 'N/A'}</li>
                            ${client.client_id ? `<li><strong>ID Client :</strong> ${client.client_id}</li>` : ''}
                        </ul>
                        <h3>Détails de la demande :</h3>
                        <p>Date souhaitée : ${new Date(data.requestDate).toLocaleDateString('fr-FR')}</p>
                        <pre>${JSON.stringify(details, null, 2)}</pre>
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