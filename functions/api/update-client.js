import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    // 1. Check Method
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), {
            status: 405,
            headers: { 'Allow': 'POST', 'Content-Type': 'application/json' }
        });
    }

    try {
        // 2. Parse Body
        const data = await context.request.json();
        const { id, table, ...updates } = data;

        console.log(`[UPDATE-CLIENT] Received update request for ${table} ID: ${id}`);

        if (!id || !table) {
            return new Response(JSON.stringify({ error: 'Missing ID or Table' }), { 
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 3. Init Supabase with Service Role
        const supabase = createClient(
            context.env.SUPABASE_URL,
            context.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // 4. Perform Update
        const { data: updatedData, error } = await supabase
            .from(table)
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('[UPDATE-CLIENT] Supabase Error:', error);
            throw error;
        }

        // 5. Success Response
        return new Response(JSON.stringify({ success: true, data: updatedData }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error('[UPDATE-CLIENT] Fatal Error:', err);
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}