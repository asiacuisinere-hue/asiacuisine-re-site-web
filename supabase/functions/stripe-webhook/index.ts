import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

async function sendWhatsAppAlert(message: string) {
  const phone = Deno.env.get("ADMIN_WHATSAPP_NUMBER");
  const apiKey = Deno.env.get("ADMIN_WHATSAPP_API_KEY");
  if (!phone || !apiKey) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    await fetch(url);
  } catch (err) { console.error("[WhatsApp Error]", err); }
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret || "");       

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { demand_id, invoice_id, amount_type } = session.metadata || {};
      const amount = session.amount_total / 100;

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // --- CAS A : COMMANDE DIRECTE (Menus) ---
      if (demand_id) {
        // 1. Récupérer les infos complètes proprement
        const { data: demande, error: fetchErr } = await supabase
            .from('demandes')
            .select('id, type, clients(first_name, last_name)')
            .eq('id', demand_id)
            .single();

        if (fetchErr) console.error("[Webhook] Fetch Error:", fetchErr);

        // 2. Déterminer le nouveau statut métier
        let newStatus = 'Payée';
        if (demande?.type === 'COMMANDE_MENU' || demande?.type === 'COMMANDE_SPECIALE') {
            newStatus = 'En attente de préparation';
        }

        // 3. Mise à jour synchronisée (Statut + Paiement)
        const { error: updErr } = await supabase
            .from('demandes')
            .update({
                status: newStatus,
                payment_status: 'paid',
                updated_at: new Date().toISOString()
            })
            .eq('id', demand_id);

        if (updErr) console.error("[Webhook] Update Error:", updErr);

        // 4. Alertes
        const clientName = demande?.clients ? `${demande.clients.first_name} ${demande.clients.last_name}` : "Client";
        await sendWhatsAppAlert(`🍱 *PAIEMENT REÇU (MENU)*\n\n👤 *Client:* ${clientName}\n💰 *Montant:* ${amount.toFixed(2)}€\n👨‍🍳 *Action:* Commande passée en cuisine.`);

        // 5. Trigger QR Code
        const { data: company } = await supabase.from('company_settings').select('*').limit(1).single();  
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-qrcode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ demandeId: demand_id, companySettings: company })
        });
      }

      // --- CAS B : FACTURE (Prestations) ---
      if (invoice_id) {
        const { data: inv } = await supabase
            .from('invoices')
            .select('*, clients(first_name, last_name), entreprises(nom_entreprise)')
            .eq('id', invoice_id)
            .single();

        const clientName = inv?.clients ? `${inv.clients.first_name} ${inv.clients.last_name}` : (inv?.entreprises?.nom_entreprise || "Client");

        if (amount_type === 'deposit') {
          await supabase.from('invoices').update({ status: 'deposit_paid', deposit_amount: amount, deposit_date: new Date().toISOString() }).eq('id', invoice_id);
          if (inv?.demand_id) await supabase.from('demandes').update({ payment_status: 'deposit_paid' }).eq('id', inv.demand_id);
          await sendWhatsAppAlert(`💳 *ACOMPTE REÇU*\n\n👤 *Client:* ${clientName}\n💰 *Montant:* ${amount.toFixed(2)}€\n📅 *Calendrier:* Date bloquée.`);
        } else {
          await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice_id);
          if (inv?.demand_id) await supabase.from('demandes').update({ payment_status: 'paid' }).eq('id', inv.demand_id);
          await sendWhatsAppAlert(`✅ *SOLDE RÉGLÉ*\n\n👤 *Client:* ${clientName}\n💰 *Montant:* ${amount.toFixed(2)}€`);
        }

        // Email Facture
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-invoice-by-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
          body: JSON.stringify({ invoiceId: invoice_id })
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
