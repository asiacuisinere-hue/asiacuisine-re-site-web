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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { demand_id, invoice_id, amount_type } = session.metadata || {};

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // --- CAS A : Paiement direct via une DEMANDE (Menu Semaine) ---
      if (demand_id) {
        console.log(`[Webhook] Processing demand payment: ${demand_id}`);
        await supabase.from('demandes').update({ status: 'Payée', payment_status: 'paid' }).eq('id', demand_id);

        // --- AUTO-TRIGGER : Envoi du QR Code par Email ---
        console.log(`[Webhook] Triggering automated QR code for demand ${demand_id}`);
        const { data: companySettings } = await supabase.from('company_settings').select('*').limit(1).single();
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-qrcode`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          },
          body: JSON.stringify({ demandeId: demand_id, companySettings })
        });
      }

      // --- CAS B : Paiement via une FACTURE (Réservation / Abonnement) ---
      if (invoice_id) {
        console.log(`[Webhook] Processing invoice payment: ${invoice_id} (Type: ${amount_type})`);
        
        if (amount_type === 'deposit') {
          const depositPaid = session.amount_total / 100;
          const { error } = await supabase
            .from('invoices')
            .update({ 
              status: 'deposit_paid',
              deposit_amount: depositPaid,
              deposit_date: new Date().toISOString()
            })
            .eq('id', invoice_id);
          
          if (error) throw error;

          // --- AUTO-TRIGGER : Envoi de la facture acquittée de l'acompte ---
          console.log(`[Webhook] Triggering automated email for invoice ${invoice_id}`);
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-invoice-by-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ invoiceId: invoice_id })
          });

        } else {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice_id);
          
          // Envoi de la facture finale payée
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-invoice-by-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
            },
            body: JSON.stringify({ invoiceId: invoice_id })
          });
        }
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