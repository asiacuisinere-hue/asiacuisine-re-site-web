import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fr from '../locales/fr.json' assert { type: 'json' };
import en from '../locales/en.json' assert { type: 'json' };
import zh from '../locales/zh.json' assert { type: 'json' };

function generateClientId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
}

const getEmailFooter = (t, lang) => {
    const baseUrl = 'https://www.asiacuisine.re';
    return `<div style="margin-top: 30px; border-top: 1px solid #eeeeee; text-align: center; color: #888; font-size: 12px; padding-top: 20px;">
        <p><strong>Asiacuisine.re</strong></p><p>${t('email.footer.tagline')}</p>
    </div>`;
};

async function sendWhatsAppAdminAlert(context, message) {
  const phone = context.env.ADMIN_WHATSAPP_NUMBER; 
  const apiKey = context.env.ADMIN_WHATSAPP_API_KEY;
  if (!phone || !apiKey) return;
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`;
    await fetch(url);
  } catch (err) { console.error(err); }
}

const getDeliveryFee = (city) => {
    if (!city) return 0;
    const c = city.toLowerCase();
    if (c.includes('denis')) return 8;
    if (c.includes('marie')) return 6;
    if (c.includes('andré') || c.includes('panon')) return 4;
    return 0;
};

export async function onRequest(context) {
    if (context.request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    try {
        const data = await context.request.json();
        const { recaptchaToken, ...formData } = data; 

        // 1. reCAPTCHA
        const RECAPTCHA_SECRET_KEY = context.env.RECAPTCHA_SECRET_KEY;
        const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', {  
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `secret=${RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`
        });
        const recaptcha = await verify.json();
        if (!recaptcha.success) return new Response(JSON.stringify({ error: 'reCAPTCHA failed' }), { status: 403 });

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // 2. Customer Management
        let clientId = null;
        let customerName = "";
        const c = formData.customer;

        if (formData.customerType === 'Particulier') {
            let { data: existing } = await supabase.from('clients').select('*').eq('email', c.email).single();
            if (!existing) {
                const { data: created } = await supabase.from('clients').insert({
                    email: c.email, first_name: c.firstName, last_name: c.lastName, phone: c.phone, type: 'Particulier'
                }).select().single();
                existing = created;
            }
            clientId = existing.id;
            customerName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        } else {
            let { data: existingEnt } = await supabase.from('entreprises').select('*').eq('contact_email', c.email).single();
            if (!existingEnt) {
                const { data: createdEnt } = await supabase.from('entreprises').insert({
                    nom_entreprise: c.companyName, contact_email: c.email, contact_phone: c.phone, contact_name: c.contactName
                }).select().single();
                existingEnt = createdEnt;
            }
            customerName = existingEnt.nom_entreprise;
        }

        // 3. Price Calculation
        let total = formData.total ? parseFloat(formData.total) : null;
        const deliveryFee = getDeliveryFee(formData.deliveryCity);
        
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

            if (basePrice > 0) {
                total = basePrice; // No auto-delivery fee for menus, handled manually by Chef if needed
            }
        } else if (formData.type === 'COMMANDE_SPECIALE' && total > 0) {
            total += deliveryFee;
        }

        // 4. Create Demand
        let details = {};
        if (formData.type === 'COMMANDE_MENU') {
            details = { formulaName: formData.formulaName, formulaOption: formData.formulaOption, deliveryCity: formData.deliveryCity };
        } else if (formData.details) {
            try {
                details = typeof formData.details === 'string' ? JSON.parse(formData.details) : formData.details;
            } catch (e) {
                details = { raw: formData.details };
            }
        }

        const { data: newDemande, error: demErr } = await supabase
            .from('demandes')
            .insert({
                client_id: clientId,
                type: formData.type,
                status: 'Intention WhatsApp',
                request_date: formData.requestDate,
                details_json: details,
                total_amount: total,
                business_unit: 'cuisine'
            })
            .select().single();

        if (demErr) throw demErr;

        // 5. Notifications
        const waMessage = `🛎️ *INTENTION DE COMMANDE*\n\n👤 *Client:* ${customerName}\n💰 *Montant:* ${total ? total+'€' : 'À fixer'}\n📍 *Ville:* ${formData.deliveryCity || '—'}\n\n_Le client vous contacte sur WhatsApp._`;
        await sendWhatsAppAdminAlert(context, waMessage);

        return new Response(JSON.stringify({ message: 'Success', id: newDemande.id }), { 
            status: 201, 
            headers: { 'Content-Type': 'application/json' } 
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
