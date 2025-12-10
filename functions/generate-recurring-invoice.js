import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Helper function to add CORS headers
const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Adjust for production
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
};

// Helper function to generate a unique invoice number
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function randomString(length) {
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let result = "";
    for (let i = 0; i < length; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
}

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }));
    }

    try {
        const { abonnementId } = await context.request.json();
        if (!abonnementId) throw new Error("ID de l'abonnement manquant.");

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch the subscription details
        const { data: subscription, error: subError } = await supabase
            .from('abonnements')
            .select(`*, clients(*), entreprises(*)`)
            .eq('id', abonnementId)
            .single();

        if (subError) throw new Error(`Abonnement non trouvé: ${subError.message}`);
        if (!subscription.monthly_price || subscription.monthly_price <= 0) {
            throw new Error("Le prix mensuel pour cet abonnement n'est pas défini ou est invalide.");
        }

        // 2. Generate a new invoice number
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const week = getWeekNumber(now);
        const dayOfWeek = now.getDay() || 7;
        const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true }).gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
        const docNum = `FA_${year}_${month}_${week}_${dayOfWeek}_${String((count || 0) + 1).padStart(4, "0")}_${randomString(6)}`;

        // 3. Create the invoice payload
        const invoiceItemDescription = `Abonnement Formule ${subscription.formule_base} - ${now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`;
        const invoicePayload = {
            client_id: subscription.client_id,
            entreprise_id: subscription.entreprise_id,
            document_number: docNum,
            total_amount: subscription.monthly_price,
            status: 'pending',
            items: [{
                name: invoiceItemDescription,
                quantity: 1,
                unit_price: subscription.monthly_price
            }]
        };

        // 4. Insert the new invoice
        const { data: newInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert(invoicePayload)
            .select()
            .single();

        if (invoiceError) throw new Error(`Erreur lors de la création de la facture: ${invoiceError.message}`);

        // 5. Update the subscription with new billing dates
        const nextBillingDate = new Date(subscription.next_billing_date || now);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        const { error: updateSubError } = await supabase
            .from('abonnements')
            .update({
                last_invoice_date: new Date().toISOString(),
                next_billing_date: nextBillingDate.toISOString().split('T')[0]
            })
            .eq('id', abonnementId);
        
        if (updateSubError) {
            // Log the error but don't fail the whole process since the invoice was created
            console.error(`Could not update subscription billing dates for ${abonnementId}: ${updateSubError.message}`);
        }

        // 6. (Optional) Send the invoice by email - This could be a separate step
        // For now, we'll just return success.

        return addCorsHeaders(new Response(JSON.stringify({ success: true, message: `Facture ${newInvoice.document_number} créée avec succès.` }), { status: 200 }));

    } catch (error) {
        console.error('Error in generate-recurring-invoice:', error);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500 }));
    }
}
