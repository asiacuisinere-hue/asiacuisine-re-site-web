import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    console.log(`[/create-request/] Function invoked with method: ${context.request.method}`);

    if (context.request.method !== 'POST') {
        const errorMessage = `Method ${context.request.method} Not Allowed. Only POST is accepted.`;
        console.error(errorMessage);
        return new Response(JSON.stringify({ error: errorMessage }), {
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
        const supabaseKey = context.env.SUPABASE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            return new Response(JSON.stringify({ error: 'Supabase configuration missing' }), { status: 500 });
        }
        const supabase = createClient(supabaseUrl, supabaseKey);

        // 4. Insérer ou mettre à jour le client
        let { data: client, error: clientError } = await supabase
            .from('clients')
            .upsert({
                email: data.customer.email,
                first_name: data.customer.firstName || null,
                last_name: data.customer.lastName || null,
                phone: data.customer.phone || null,
                type: data.customer.type || 'Particulier', // Peut être défini par le formulaire
                company_name: data.customer.companyName || null,
                siret: data.customer.siret || null,
                address: data.customer.address || null
            })
            .select()
            .single();

        if (clientError) {
            console.error('Supabase client upsert error:', clientError);
            throw clientError;
        }

        // 5. Préparer les détails spécifiques à la demande
        let details = {};
        let deliveryCity = null;

        if (data.type === 'COMMANDE_MENU') {
            if (!data.formulaName || !data.deliveryCity) {
                return new Response(JSON.stringify({ error: 'Missing required fields for COMMANDE_MENU' }), { status: 400 });
            }
            details = {
                formulaName: data.formulaName,
                formulaOption: data.formulaOption || null
            };
            deliveryCity = data.deliveryCity;
        } else if (data.type === 'RESERVATION_SERVICE') {
            if (!data.serviceType || !data.numberOfPeople) {
                return new Response(JSON.stringify({ error: 'Missing required fields for RESERVATION_SERVICE' }), { status: 400 });
            }
            details = {
                serviceType: data.serviceType,
                numberOfPeople: data.numberOfPeople,
                customerMessage: data.customerMessage || null
            };
            // Pour les services, la ville de livraison n'est pas directement applicable ici, ou peut être dans le message
        } else if (data.type === 'DEMANDE_ENTREPRISE') {
            // TODO: Ajouter la validation et les détails spécifiques pour les demandes d'entreprise
            details = {
                // ... champs spécifiques à l'entreprise
                customerMessage: data.customerMessage || null
            };
        } else {
            return new Response(JSON.stringify({ error: 'Invalid request type' }), { status: 400 });
        }

        // 6. Insérer la demande
        const { error: demandeError } = await supabase
            .from('demandes')
            .insert({
                client_id: client.id,
                type: data.type,
                status: 'Nouvelle',
                request_date: data.requestDate,
                details_json: details,
                // Si la ville de livraison est pertinente pour le type de demande, l'ajouter ici
                // Par exemple, pour COMMANDE_MENU, on pourrait avoir une colonne delivery_city dans demandes
                // Pour l'instant, elle est dans details_json pour COMMANDE_MENU
            });

        if (demandeError) {
            console.error('Supabase demande insert error:', demandeError);
            throw demandeError;
        }

        return new Response(JSON.stringify({ message: 'Request received and processed successfully.' }), { status: 201 });

    } catch (error) {
        console.error('Error processing request:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 });
    }
}