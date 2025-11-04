import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
            status: 405,
            headers: { 'Allow': 'POST' }
        });
    }

    try {
        const data = await context.request.json();

        // 2. Valider les données de base
        if (!data.type || !data.customer || !data.customer.email || !data.requestDate) {
            return new Response(JSON.stringify({ error: 'Missing required base fields (type, customer.email, requestDate)' }), { status: 400 });
        }

        // 3. Initialiser Supabase
        const supabaseUrl = context.env.SUPABASE_URL;
        const supabaseServiceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            return new Response(JSON.stringify({ error: 'Supabase configuration missing' }), { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 4. Insérer ou mettre à jour le client
        let { data: client, error: clientError } = await supabase
            .from('clients')
            .upsert({
                email: data.customer.email,
                first_name: data.customer.firstName || null,
                last_name: data.customer.lastName || null,
                phone: data.customer.phone || null,
                type: data.customer.type || 'Particulier',
                company_name: data.customer.companyName || null,
                siret: data.customer.siret || null,
                address: data.customer.address || null
            }, { onConflict: 'email' })
            .select()
            .single();

        if (clientError) throw clientError;

        // 5. Préparer les détails spécifiques à la demande
        let details = {};
        if (data.type === 'COMMANDE_MENU') {
            details = { formulaName: data.formulaName, formulaOption: data.formulaOption, deliveryCity: data.deliveryCity };
        } else if (data.type === 'RESERVATION_SERVICE') {
            details = { serviceType: data.serviceType, numberOfPeople: data.numberOfPeople, customerMessage: data.customerMessage };
        }

        // 6. Insérer la demande
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

        // 7. Envoyer l'e-mail de notification
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
                        </ul>
                        <h3>Détails de la demande :</h3>
                        <p>Date souhaitée : ${new Date(data.requestDate).toLocaleDateString('fr-FR')}</p>
                        <pre>${JSON.stringify(details, null, 2)}</pre>
                    `
                });
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Ne pas bloquer la réponse au client si l'e-mail échoue
            }
        }

        return new Response(JSON.stringify({ message: 'Request received and processed successfully.' }), { status: 201 });

    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
    }
}
