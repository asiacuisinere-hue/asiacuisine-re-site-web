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

        // 1. reCAPTCHA Verification
        const RECAPTCHA_SECRET_KEY = context.env.RECAPTCHA_SECRET_KEY;
        if (!RECAPTCHA_SECRET_KEY) {
            console.error("ERREUR: RECAPTCHA_SECRET_KEY manquante");
            return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500 });
        }

        const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: RECAPTCHA_SECRET_KEY,
                response: recaptchaToken || '',
                remoteip: context.request.headers.get('CF-Connecting-IP') || ''
            })
        });
        const recaptcha = await verify.json();

        const isLocal = context.request.url.includes('127.0.0.1') || context.request.url.includes('localhost');
        if (!recaptcha.success && !isLocal) {
            return new Response(JSON.stringify({
                error: 'reCAPTCHA failed',
                details: recaptcha
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
            details = { 
                formulaName: formData.formulaName, 
                formulaOption: formData.formulaOption, 
                deliveryCity: formData.deliveryCity 
            };
        } else if (formData.type === 'RESERVATION_SERVICE') {
            details = {
                serviceType: formData.serviceType || formData.service,
                heure: formData.heure,
                numberOfPeople: formData.numberOfPeople || formData.personnes,
                ville: formData.ville,
                budget: formData.budget,
                allergies: formData.allergies,
                customerMessage: formData.customerMessage || formData.message,
                address: formData.address
            };
        }

        // 5. INSERTION DEMANDE
        const { data: newDemande, error: demErr } = await supabase
            .from('demandes')
            .insert({
                client_id: clientId,
                entreprise_id: entrepriseId,
                type: formData.type,
                status: 'Nouvelle',
                request_date: formData.requestDate,
                details_json: details,
                total_amount: total,
                business_unit: 'cuisine'
            })
            .select().single();

        if (demErr) throw new Error("Erreur insertion demande: " + demErr.message);

        // 6. Alerte Admin
        const displayCity = formData.ville || formData.deliveryCity || details.ville || '—';
        const waMsg = `🔔 *NOUVELLE DEMANDE*\n👤 *Client:* ${customerName}\n📋 *Type:* ${formData.type}\n📍 *Ville:* ${displayCity}`;
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
