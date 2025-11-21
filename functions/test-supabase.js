import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(context) {
    try {
        console.log('--- [DEBUG] test-supabase: Function started.');
        
        // Initialiser Supabase (sans faire de requête pour l'instant)
        const supabase = createClient(
            context.env.SUPABASE_URL, 
            context.env.SUPABASE_KEY // Utilisation de SUPABASE_KEY public pour ce test
        );
        console.log('--- [DEBUG] test-supabase: Supabase client initialized.');

        return new Response("Supabase client initialized successfully!", { status: 200 });

    } catch (error) {
        console.error('--- [ERROR] test-supabase: Caught exception:', error.message);
        return new Response(`Error: ${error.message}`, { status: 500 });
    }
}
