import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// --- Helpers ---

const addCorsHeaders = (response) => {
    response.headers.set('Access-Control-Allow-Origin', '*'); // Allow any origin
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Expose-Headers', 'Content-Disposition'); // Expose Content-Disposition for frontend
    return response;
};

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
}

function getWeeklyColor() {
    const colors = ['2c3e50', 'c0392b', '2980b9', '27ae60', 'f39c12', '8e44ad', 'd35400']; // Colors without #
    const weekNumber = getWeekNumber(new Date());
    return colors[weekNumber % colors.length];
}

// --- Cloudflare Pages Functions Exports ---

// Handle POST requests
export async function onRequestPost(context) {
    console.log('[DEBUG] send-qrcode function called with method:', context.request.method);
    
    try {
        const { request, env } = context;
        const { demandeId } = await request.json();

        if (!demandeId) {
            return addCorsHeaders(new Response(
                JSON.stringify({ error: 'Missing demandeId' }), 
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            ));
        }

        const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
        const resend = new Resend(env.RESEND_API_KEY);

        console.log('[DEBUG] Fetching demande:', demandeId);
        const { data: demande, error } = await supabase
            .from('demandes')
            .select('id, request_date, status, clients (email, first_name), entreprises (contact_email, nom_entreprise)')
            .eq('id', demandeId)
            .single();

        if (error || !demande) throw new Error(error?.message || 'Demande non trouvée');
        
        const clientEmail = demande.clients?.email || demande.entreprises?.contact_email;
        const clientName = demande.clients?.first_name || demande.entreprises?.nom_entreprise || 'client';
        if (!clientEmail) throw new Error('Email client non trouvé pour cette demande.');

        // Format date for display and URL
        const displayDate = new Date(demande.request_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const urlDate = new Date(demande.request_date).toISOString().split('T')[0];

        // Build QR Code API URL
        const weeklyColor = getWeeklyColor();
        const qrData = encodeURIComponent(`https://www.asiacuisine.re/suivi?id=${demande.id}&date=${urlDate}`);
        const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&color=${weeklyColor}`;

        console.log('[DEBUG] Sending QR code email...');
        await resend.emails.send({
            from: 'contact@asiacuisine.re',
            to: clientEmail,
            subject: `Votre QR code pour votre commande Asiacuisine.re du ${displayDate}`,
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px; background-color: #f4f4f4;">
                    <div style="max-width: 400px; margin: auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        <div style="background-color: #${weeklyColor}; color: white; padding: 15px;">
                            <h1 style="margin: 0; font-size: 20px;">Commande du ${displayDate}</h1>
                        </div>
                        <div style="padding: 30px 20px;">
                            <p>Bonjour ${clientName},</p>
                            <p>Veuillez présenter le QR code ci-dessous lors de la réception de votre commande.</p>
                            <img src="${qrCodeApiUrl}" alt="QR Code de suivi" style="width: 200px; height: 200px; margin: 20px auto; display: block;"/>
                            <p style="font-size: 1.4em; font-weight: bold; margin-top: 10px; letter-spacing: 2px;">
                                ${demande.id.substring(0,8).toUpperCase()}
                            </p>
                        </div>
                        <div style="background-color: #f9f9f9; padding: 15px; font-size: 12px; color: #666;">
                            L'équipe Asiacuisine.re
                        </div>
                    </div>
                </div>
            `,
        });
        console.log('[DEBUG] QR code email sent.');

        console.log("[DEBUG] Updating demand status to 'En attente de préparation'...");
        const { error: updateError } = await supabase
            .from('demandes')
            .update({ status: 'En attente de préparation' })
            .eq('id', demandeId);
        if (updateError) throw new Error(`Failed to update demande status: ${updateError.message}`);
        console.log("[DEBUG] Demand status updated.");

        return addCorsHeaders(new Response(JSON.stringify({ success: true, message: 'QR Code sent and status updated' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }));

    } catch (error) {
        console.error('[ERROR] send-qrcode:', error.message);
        return addCorsHeaders(new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message, stack: error.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }));
    }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions(context) {
    return addCorsHeaders(new Response(null, { status: 204 }));
}