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
        const { demand_id, invoice_id, amount_type } = await req.json();

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        let amount = 0;
        let customerEmail = '';
        let customerName = '';
        let description = '';
        let metadata: any = { amount_type };

        if (invoice_id) {
            const { data: invoice } = await supabase
                .from('invoices')
                .select('*, clients(email, first_name, last_name), entreprises(contact_email, nom_entreprise)')
                .eq('id', invoice_id)
                .single();
            
            if (!invoice) throw new Error("Facture introuvable");

            customerEmail = invoice.clients?.email || invoice.entreprises?.contact_email || '';
            customerName = invoice.clients ? `${invoice.clients.first_name} ${invoice.clients.last_name}` : invoice.entreprises?.nom_entreprise;
            
            if (amount_type === 'deposit') {
                amount = invoice.total_amount * 0.30;
                description = `Acompte (30%) - Facture ${invoice.document_number || invoice.id.substring(0,8)}`;
            } else {
                amount = invoice.total_amount - (invoice.deposit_amount || 0);
                description = `Solde - Facture ${invoice.document_number || invoice.id.substring(0,8)}`;
            }
            metadata.invoice_id = invoice_id;
        } else if (demand_id) {
            const [demRes, setRes] = await Promise.all([
                supabase.from('demandes').select('*, clients(email, first_name, last_name)').eq('id', demand_id).single(),
                supabase.from('settings').select('*')
            ]);
            const demande = demRes.data;
            if (!demande) throw new Error("Demande introuvable");
            customerEmail = demande.clients?.email || '';
            customerName = `${demande.clients?.first_name} ${demande.clients?.last_name}`;
            amount = parseFloat(demande.total_amount);
            if (!amount || amount <= 0) {
                const settings = {};
                setRes.data?.forEach((s:any) => settings[s.key] = parseFloat(s.value));
                const formula = demande.details_json?.formulaName || "";
                if (formula.includes('Découverte')) amount = settings['menu_decouverte_price'];
                else if (formula.includes('Standard')) amount = settings['menu_standard_price'];
                else if (formula.includes('Duo')) amount = settings['menu_duo_price'];
            }
            description = `Commande Menu #${demande.id.substring(0,8)}`;
            metadata.demand_id = demand_id;
        }

        if (!amount || amount <= 0) throw new Error("Montant invalide.");

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            customer_email: customerEmail || undefined,
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: { name: description, description: `Client: ${customerName}` },
                    unit_amount: Math.round(amount * 100),
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `https://www.asiacuisine.re/suivi.html?status=success`,
            cancel_url: `https://www.asiacuisine.re/suivi.html?status=cancel`,
            metadata: metadata
        });

        // --- NOUVEAU : Enregistrer le lien dans la facture ---
        if (invoice_id) {
            await supabase.from('invoices').update({ payment_link: session.url }).eq('id', invoice_id);
        }

        return new Response(JSON.stringify({ url: session.url }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
