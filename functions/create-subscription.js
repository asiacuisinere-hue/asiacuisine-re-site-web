import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', 'https://www.asiacuisine.re'); // Only allow main site
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }
    if (context.request.method !== 'POST') {
        return addCorsHeaders(new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { status: 405, headers: { 'Allow': 'POST' } }));
    }

    try {
        const data = await context.request.json();
        console.log('--- [DEBUG] Received subscription data:', JSON.stringify(data, null, 2));

        if (!data.nom || !data.prenom || !data.email || !data.phone || !data.formula) {
            console.error('--- [ERROR] Missing required subscription fields');
            return addCorsHeaders(new Response(JSON.stringify({ error: 'Missing required fields (nom, prenom, email, phone, formula)' }), { status: 400 }));
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        let clientId = null;
        // 1. Chercher ou créer le client
        let { data: client, error: fetchError } = await supabase
            .from('clients')
            .select('*')
            .eq('email', data.email)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; // PGRST116 = no rows found

        if (!client) {
            const newId = generateClientId(); // Assuming generateClientId is defined elsewhere, or use default uuid
            const { data: newClient, error: insertError } = await supabase
                .from('clients')
                .insert({
                    email: data.email,
                    first_name: data.prenom,
                    last_name: data.nom,
                    phone: data.phone,
                    client_id: newId // If you have a custom client_id generator
                })
                .select()
                .single();
            
            if (insertError) throw insertError;
            client = newClient;
        }
        clientId = client.id;

        // 2. Créer l'abonnement
        const { error: subscriptionError } = await supabase
            .from('abonnements')
            .insert({
                client_id: clientId,
                formule_base: data.formula,
                notes: data.notes || null,
                status: 'en_attente' // Statut initial
            });

        if (subscriptionError) throw subscriptionError;

        // 3. Envoyer notification par e-mail
        const resendApiKey = context.env.RESEND_API_KEY;
        if (resendApiKey) {
            const resend = new Resend(resendApiKey);

            await resend.emails.send({
                from: 'abonnement@asiacuisine.re',
                to: 'contact@asiacuisine.re', // Envoyer à l'administrateur
                subject: `Nouvelle demande d'abonnement pour la formule ${data.formula}`,
                html:
                    `
                    <p>Une nouvelle demande d\'abonnement a été soumise :</p>
                    <ul>
                        <li><strong>Formule :</strong> ${data.formula}</li>
                        <li><strong>Nom :</strong> ${data.nom} ${data.prenom}</li>
                        <li><strong>Email :</strong> ${data.email}</li>
                        <li><strong>Téléphone :</strong> ${data.phone}</li>
                        <li><strong>Notes :</strong> ${data.notes || 'N/A'}</li>
                    </ul>
                    <p>Veuillez contacter le client pour discuter des détails.</p>
                `,
            });
        }
        
        return addCorsHeaders(new Response(JSON.stringify({ success: true, message: 'Demande d\'abonnement envoyée avec succès.' }), { status: 200 }));

    } catch (error) {
        console.error('--- [ERREUR] Erreur capturée dans create-subscription ---');
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}

// Fonction utilitaire pour générer un ID client si nécessaire
// Assurez-vous que cette fonction est cohérente avec votre logique client_id
function generateClientId() {
    // Si client_id est un UUID par défaut dans Supabase, vous n'avez pas besoin de cette fonction.
    // Sinon, implémentez votre logique de génération d'ID ici.
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
