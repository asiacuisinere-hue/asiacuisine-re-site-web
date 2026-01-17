import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    console.log('🚀 lookup-request called');
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': 'application/json'
    };

    if (context.request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers });
    }
    
    if (context.request.method !== 'GET') {
        return new Response(
            JSON.stringify({ error: `Method ${context.request.method} Not Allowed` }), 
            { status: 405, headers: { ...headers, 'Allow': 'GET' } }
        );
    }

    try {
        const url = new URL(context.request.url);
        const id = url.searchParams.get('id');
        
        console.log('📝 Received ID:', id);

        if (!id || typeof id !== 'string' || id.length !== 8) {
            console.log('❌ Invalid ID format');
            return new Response(
                JSON.stringify({ error: 'A valid 8-character request ID is required.' }), 
                { status: 400, headers }
            );
        }

        console.log('🔑 Creating Supabase client...');
        console.log('ENV Check - URL exists:', !!context.env.SUPABASE_URL);
        console.log('ENV Check - Key exists:', !!context.env.SUPABASE_SERVICE_ROLE_KEY);

        const supabase = createClient(
            context.env.SUPABASE_URL, 
            context.env.SUPABASE_SERVICE_ROLE_KEY
        );

        console.log('🔍 Querying demandes_lookup table...');

        const { data, error } = await supabase
            .from('demandes_lookup')
            .select('short_id, created_at, type, status')
            .like('short_id', `${id.toLowerCase()}%`)
            .limit(1)
            .single();

        console.log('Query result - Error:', error, 'Data:', !!data);

        if (error) {
            console.error('❌ Supabase error:', error);
            
            if (error.code === 'PGRST116') {
                return new Response(
                    JSON.stringify({ error: 'Request not found.' }), 
                    { status: 404, headers }
                );
            }
            throw error;
        }

        if (!data) {
            console.log('⚠️ No data found');
            return new Response(
                JSON.stringify({ error: 'Request not found.' }), 
                { status: 404, headers }
            );
        }

        const responsePayload = {
            id: data.short_id,
            created_at: data.created_at,
            type: data.type,
            status: data.status
        };
        
        console.log('✅ Success - returning data');
        return new Response(
            JSON.stringify(responsePayload), 
            { status: 200, headers }
        );

    } catch (error) {
        console.error('💥 Exception:', error);
        return new Response(
            JSON.stringify({ 
                error: 'Internal Server Error', 
                details: error.message 
            }), 
            { status: 500, headers }
        );
    }
}
