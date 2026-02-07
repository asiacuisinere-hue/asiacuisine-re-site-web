import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { demand_id, amount_type } = await req.json(); // amount_type: 'total' or 'deposit'

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Récupérer les infos de la demande (clients ET entreprises)
        const { data: demande, error: demandeError } = await supabase
            .from('demandes')
            .select(`
                *,
                clients (email, first_name, last_name),
                entreprises (contact_email, nom_entreprise, contact_name)
            `)
            .eq('id', demand_id)
            .single();

        if (demandeError || !demande) {
            throw new Error("Demande introuvable");
        }

        // 2. Déterminer l'identité du payeur
        let customerEmail = '';
        let customerName = '';

        if (demande.clients) {
            customerEmail = demande.clients.email;
            customerName = `${demande.clients.first_name} ${demande.clients.last_name}`;
        } else if (demande.entreprises) {
            customerEmail = demande.entreprises.contact_email;
            customerName = `${demande.entreprises.nom_entreprise} (${demande.entreprises.contact_name})`;
        } else {
            // Cas rare : client supprimé ou données incohérentes
            customerName = "Client inconnu";
        }

        // 3. Définir le montant et vérifier sa validité
        let amount = parseFloat(demande.total_amount);
        
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Le montant de la commande est invalide (0 ou vide). Veuillez mettre à jour le montant dans le dashboard.");
        }

        let description = `Paiement pour commande #${demande.id.substring(0, 8)}`;

        if (amount_type === 'deposit') {
            amount = amount * 0.30; // Acompte de 30%
            description = `Acompte (30%) pour commande #${demande.id.substring(0, 8)}`;
        }

        // Vérification montant minimum Stripe (50 centimes environ)
        if (amount < 0.50) {
             throw new Error("Le montant est trop faible pour être encaissé via Stripe.");
        }

        // 4. Préparer les paramètres Stripe
        const sessionParams: any = {
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: description,
                            description: `Client: ${customerName}`,
                        },
                        unit_amount: Math.round(amount * 100), // Montant en centimes
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `https://asiacuisine.re/suivi?id=${demande.id}&status=success`,
            cancel_url: `https://asiacuisine.re/suivi?id=${demande.id}&status=cancel`,
            metadata: {
                demand_id: demande.id,
                amount_type: amount_type
            }
        };

        // N'ajouter l'email que s'il est valide
        if (customerEmail && customerEmail.includes('@')) {
            sessionParams.customer_email = customerEmail;
        }

        // 5. Créer la session Stripe Checkout
        const session = await stripe.checkout.sessions.create(sessionParams);

        // 6. Stocker l'ID de la session
        await supabase
            .from('demandes')
            .update({ 
                payment_status: 'waiting',
                stripe_session_id: session.id
            })
            .eq('id', demand_id);

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});