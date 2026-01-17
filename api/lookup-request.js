import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export async function onRequest(context) {
    // This is a Cloudflare Pages Function.
    // It uses the context object and returns Response objects.

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { headers });
    }
    
    if (context.request.method !== 'GET') {
        return new Response(JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), { 
            status: 405, 
            headers: { ...headers, 'Allow': 'GET' }
        });
    }

    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');

        if (!id || typeof id !== 'string' || id.length !== 8) {
            return new Response(JSON.stringify({ error: 'A valid 8-character request ID is required.' }), { status: 400, headers });
        }

        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        const { data, error } = await supabase
            .from('demandes_with_text_id')
            .select('id_text, created_at, type, status')
            .ilike('id_text', `${id}%`)
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return new Response(JSON.stringify({ error: 'Request not found.' }), { status: 404, headers });
            }
            throw error;
        }

        if (!data) {
            return new Response(JSON.stringify({ error: 'Request not found.' }), { status: 404, headers });
        }

        const responsePayload = {
            id: data.id_text,
            created_at: data.created_at,
            type: data.type,
            status: data.status
        };
        
        return new Response(JSON.stringify(responsePayload), { 
            status: 200, 
            headers
        });

    } catch (error) {
        console.error('Error fetching demand status:', error.message);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), { status: 500, headers });
    }
}
