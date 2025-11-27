import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response, origin) => {
    const allowedOrigins = [
        'https://www.asiacuisine.re',
        'https://gestion.asiacuisine.re'
    ];
    
    if (allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
        response.headers.set('Access-Control-Allow-Origin', 'https://www.asiacuisine.re');
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    const origin = context.request.headers.get('Origin');
    
    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }), origin);
    }
    
    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);

        const settingKeys = [
            'menu_decouverte', 'menu_standard', 'menu_confort', 'menu_duo',
            'menu_override_message', 'menu_override_enabled'
        ];
        const { data: menuSettingsData, error: settingsError } = await supabase
            .from('settings')
            .select('key, value')
            .in('key', settingKeys);

        if (settingsError) throw settingsError;

        const menuSettings = {};
        if (menuSettingsData) {
            menuSettingsData.forEach(setting => {
                menuSettings[setting.key] = setting.value;
            });
        }

        const { data: companyData, error: companyError } = await supabase
            .from('company_settings')
            .select('order_cutoff_days, order_cutoff_hour')
            .limit(1)
            .single();

        if (companyError) {
            console.error('Error fetching company settings for cutoff dates:', companyError);
        }

        const defaultSettings = {
            order_cutoff_days: 2,
            order_cutoff_hour: 11
        };

        const finalSettings = { 
            ...defaultSettings, 
            ...menuSettings,
            ...companyData
        };

        return addCorsHeaders(
            new Response(JSON.stringify(finalSettings), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }), 
            origin
        );

    } catch (error) {
        return addCorsHeaders(
            new Response(JSON.stringify({ error: 'Internal Server Error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }), 
            origin
        );
    }
}