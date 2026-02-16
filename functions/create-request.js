import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function generateClientId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }     
    return result;
}

async function sendWhatsAppAdminAlert(context, message) {
  const phone = context.env.ADMIN_WHATSAPP_NUMBER;
  const apiKey = context.env.ADMIN_WHATSAPP_API_KEY;
  if (!phone || !apiKey) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    await fetch(url);
  } catch (err) { console.error("WA_ALERT_ERR:", err); }
}

export async function onRequest(context) {
    if (context.request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });    

    try {
        const data = await context.request.json();
        const { recaptchaToken, ...formData } = data;

        // 1. reCAPTCHA (Désactivé en local si nécessaire, mais on garde la logique)
        const RECAPTCHA_SECRET_KEY = context.env.RECAPTCHA_SECRET_KEY;
        const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        });
        const recaptcha = await verify.json();
        // Si on est en local, on peut être plus souple sur le recaptcha pour le test
        const isLocal = context.request.url.includes('127.0.0.1') || context.request.url.includes('localhost');
        if (!recaptcha.success && !isLocal) {
            console.error("RECAPTCHA_VERIFY_ERROR:", JSON.stringify(recaptcha));
            return new Response(JSON.stringify({ 
                error: 'reCAPTCHA failed', 
                details: recaptcha // Renvoie l'erreur complète de Google
            }), { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);   

        // 2. Gestion du Client / Entreprise
        let clientId = null;
        let entrepriseId = null;
        let customerName = "";
        const c = formData.customer;

        if (formData.customerType === 'Particulier' || !formData.customerType) {
            let { data: existing } = await supabase.from('clients').select('*').eq('email', c.email).maybeSingle();
            if (!existing) {
                const { data: created, error: createErr } = await supabase.from('clients').insert({
                    email: c.email, first_name: c.firstName, last_name: c.lastName, phone: c.phone, type: 'Particulier', client_id: generateClientId()
                }).select().single();
                if (createErr) throw new Error("Erreur création client: " + createErr.message);
                existing = created;
            }
            clientId = existing.id;
            customerName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        } else {
            let { data: existingEnt } = await supabase.from('entreprises').select('*').eq('contact_email', c.email).maybeSingle();
            if (!existingEnt) {
                const { data: createdEnt, error: entErr } = await supabase.from('entreprises').insert({
                    nom_entreprise: c.companyName || c.lastName, contact_email: c.email, contact_phone: c.phone, contact_name: c.firstName || c.contactName
                }).select().single();
                if (entErr) throw new Error("Erreur création entreprise: " + entErr.message);
                existingEnt = createdEnt;
            }
            entrepriseId = existingEnt.id;
            customerName = existingEnt.nom_entreprise;
        }

        // 3. Calcul du Prix (Logique Menu)
        let total = formData.total ? parseFloat(formData.total) : null;
        if (formData.type === 'COMMANDE_MENU') {
            const { data: settings } = await supabase.from('settings').select('key, value');
            const prices = {};
            settings?.forEach(s => prices[s.key] = parseFloat(s.value));
            const formula = formData.formulaName || "";
            let basePrice = 0;
            if (formula.includes('Découverte')) basePrice = prices['menu_decouverte_price'];
            else if (formula.includes('Standard')) basePrice = prices['menu_standard_price'];
            else if (formula.includes('Confort')) basePrice = prices['menu_confort_price'];
            else if (formula.includes('Duo')) basePrice = prices['menu_duo_price'];
            if (basePrice > 0) total = basePrice;
        }

        // 4. Détails JSON
        let details = formData.details || {};
        if (formData.type === 'COMMANDE_MENU') {
            details = { formulaName: formData.formulaName, formulaOption: formData.formulaOption, deliveryCity: formData.deliveryCity };
        }

        // 5. INSERTION DEMANDE
        const { data: newDemande, error: demErr } = await supabase
            .from('demandes')
            .insert({
                client_id: clientId,
                entreprise_id: entrepriseId, // AJOUTÉ : Support entreprise
                type: formData.type,
                status: 'Intention WhatsApp',
                request_date: formData.requestDate,
                details_json: details,
                total_amount: total,
                business_unit: 'cuisine'
            })
            .select().single();

        if (demErr) throw new Error("Erreur insertion demande: " + demErr.message);

        // 6. Alerte Admin
        const waMsg = `🔔 *INTENTION DE COMMANDE*\n👤 *Client:* ${customerName}\n💰 *Montant:* ${total ? total+'€' : 'À fixer'}\n📍 *Ville:* ${formData.deliveryCity || '—'}`;
        await sendWhatsAppAdminAlert(context, waMsg);

        return new Response(JSON.stringify({ message: 'Success', id: newDemande.id }), { 
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error("CREATE_REQUEST_ERROR:", error.message);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
