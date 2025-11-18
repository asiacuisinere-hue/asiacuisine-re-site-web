import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
    console.log('--- [DEBUG] get-menus function called ---');
    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);

        const { data, error } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', [
                'menu_decouverte',
                'menu_standard',
                'menu_confort',
                'menu_duo',
                'menu_override_message',
                'menu_override_enabled'
            ]);

        if (error) {
            console.error('--- [ERROR] get-menus: Supabase error ---', error);
            throw error;
        }

        const settings = data.reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {});

        console.log('--- [DEBUG] get-menus: Returning settings ---', settings);

        return new Response(JSON.stringify(settings), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('--- [ERROR] get-menus: Caught exception ---', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error', details: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}