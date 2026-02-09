import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Helper to send WhatsApp notification via CallMeBot (Best for Admin alerts)
async function sendWhatsAppAlert(message: string) {
  const phone = Deno.env.get("ADMIN_WHATSAPP_NUMBER"); // International format without + (ex: 262692...)
  const apiKey = Deno.env.get("ADMIN_WHATSAPP_API_KEY");
  
  if (!phone || !apiKey) {
    console.log("[WhatsApp] Config missing (ADMIN_WHATSAPP_NUMBER or API_KEY)");
    return;
  }

  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    const response = await fetch(url);
    if (response.ok) {
        console.log("[WhatsApp] Admin alert sent successfully");
    } else {
        console.error("[WhatsApp] Failed to send alert. Status:", response.status);
    }
  } catch (err) {
    console.error("[WhatsApp] Error sending alert:", err);
  }
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  try {
    const body = await req.text();
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret || "");
    } catch (err) {
      console.error(`[Webhook] Signature verification failed: ${err.message}`);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    console.log(`[Webhook] Event Received: ${event.type}`);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { demand_id, invoice_id, amount_type } = session.metadata || {};
      const amount = session.amount_total / 100;

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // --- CAS A : Paiement direct via une DEMANDE (Menu Semaine) ---
      if (demand_id) {
        console.log(`[Webhook] Processing demand payment: ${demand_id}`);
        
        // 1. Mark as PAID first
        await supabase.from('demandes').update({ payment_status: 'paid' }).eq('id', demand_id);

        const { data: demande } = await supabase
            .from('demandes')
            .select('*, clients(first_name, last_name)')
            .eq('id', demand_id)
            .single();
        
        let newStatus = 'Payée';
        if (demande?.type === 'COMMANDE_MENU' || demande?.type === 'COMMANDE_SPECIALE') {
            newStatus = 'En attente de préparation';
        }

        await supabase.from('demandes').update({ 
            status: newStatus, 
            updated_at: new Date().toISOString() 
        }).eq('id', demand_id);

        // 2. WhatsApp Notification to Admin
        const clientName = demande?.clients ? `${demande.clients.first_name} ${demande.clients.last_name}` : "Client Inconnu";
        await sendWhatsAppAlert(`🍱 *NOUVEAU PAIEMENT MENU*\n\n👤 *Client:* ${clientName}\n💰 *Montant:* ${amount.toFixed(2)}€\n👨‍🍳 *Statut:* Passé en cuisine\n\n_Le QR Code a été envoyé automatiquement._`);

        // 3. Trigger QR Code Email
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

      // --- CAS B : Paiement via une FACTURE (Réservation / Solde) ---
      if (invoice_id) {
        const { data: invoiceData } = await supabase
            .from('invoices')
            .select('*, clients(first_name, last_name), entreprises(nom_entreprise)')
            .eq('id', invoice_id)
            .single();

        const clientName = invoiceData?.clients 
            ? `${invoiceData.clients.first_name} ${invoiceData.clients.last_name}` 
            : (invoiceData?.entreprises?.nom_entreprise || "Client");

        if (amount_type === 'deposit') {
          await supabase.from('invoices').update({ status: 'deposit_paid', deposit_amount: amount, deposit_date: new Date().toISOString() }).eq('id', invoice_id);
          if (invoiceData?.demand_id) await supabase.from('demandes').update({ payment_status: 'deposit_paid' }).eq('id', invoiceData.demand_id);

          await sendWhatsAppAlert(`💳 *ACOMPTE REÇU*\n\n👤 *Client:* ${clientName}\n💰 *Montant:* ${amount.toFixed(2)}€\n📄 *Facture:* ${invoiceData?.document_number || invoice_id.substring(0,8)}\n📅 *Date bloquée:* Automatiquement`);

          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-invoice-by-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
            body: JSON.stringify({ invoiceId: invoice_id })
          });
        } else {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice_id);
          if (invoiceData?.demand_id) await supabase.from('demandes').update({ payment_status: 'paid' }).eq('id', invoiceData.demand_id);

          await sendWhatsAppAlert(`✅ *SOLDE RÉGLÉ*\n\n👤 *Client:* ${clientName}\n💰 *Montant:* ${amount.toFixed(2)}€\n📄 *Facture:* ${invoiceData?.document_number || invoice_id.substring(0,8)}`);

          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-invoice-by-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
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
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
