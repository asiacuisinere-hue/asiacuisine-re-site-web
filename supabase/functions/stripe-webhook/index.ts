import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  try {
    const body = await req.text();
    let event;

    // 1. Vérifier l'authenticité de l'événement
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        endpointSecret || ""
      );
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // 2. Gérer l'événement de paiement réussi
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const demandId = session.metadata?.demand_id;

      if (demandId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        console.log(`[Webhook] Payment successful for demand ${demandId}`);

        // Mettre à jour la demande
        const { error: updateError } = await supabase
          .from('demandes')
          .update({ 
            status: 'Payée', // Passe en violet dans votre dashboard
            payment_status: 'paid'
          })
          .eq('id', demandId);

        if (updateError) throw updateError;

        // Optionnel : On peut aussi créer/mettre à jour la facture ici si besoin
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[Webhook Error] ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
