import { createClient } from '@supabase/supabase-js';

const addCorsHeaders = (response, origin) => {
    const allowedOrigins = ['https://www.asiacuisine.re', 'https://gestion.asiacuisine.re'];
    if (allowedOrigins.includes(origin)) { response.headers.set('Access-Control-Allow-Origin', origin); } 
    else { response.headers.set('Access-Control-Allow-Origin', 'https://www.asiacuisine.re'); }
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
};

export async function onRequest(context) {
    const origin = context.request.headers.get('Origin');
    const url = new URL(context.request.url);
    const week = url.searchParams.get('week');
    const year = url.searchParams.get('year');

    if (context.request.method === 'OPTIONS') {
        return addCorsHeaders(new Response(null, { status: 204 }), origin);
    }

    try {
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_KEY);

        // 1. Récupérer les paramètres globaux (Fallback)
        const settingKeys = [
            'menu_decouverte', 'menu_standard', 'menu_confort', 'menu_duo',
            'menu_override_message', 'menu_override_enabled',
            'menu_decouverte_price', 'menu_standard_price', 'menu_confort_price', 'menu_duo_price',       
            'special_offer_enabled', 'special_offer_details', 'special_offer_disables_formulas'
        ];
        const { data: menuSettingsData, error: settingsError } = await supabase.from('settings').select('key, value').in('key', settingKeys);
        if (settingsError) throw settingsError;

        const result = { _source: 'global_settings' };
        if (menuSettingsData) {
            menuSettingsData.forEach(setting => { result[setting.key] = setting.value; });
        }

        // 2. Tenter de récupérer le planning spécifique
        if (week && year) {
            const { data: plannedMenu, error: planError } = await supabase
                .from('menus_planning')
                .select('*')
                .eq('year', parseInt(year))
                .eq('week_number', parseInt(week))
                .maybeSingle();

            if (plannedMenu) {
                // On vérifie si au moins un menu est rempli
                const hasContent = (m) => m && (typeof m === 'string' ? m.length > 5 : (m.fr && m.fr.trim() !== ""));
                
                if (hasContent(plannedMenu.menu_decouverte) || hasContent(plannedMenu.menu_standard)) {
                    result._source = `planned_menu_w${week}_y${year}`;
                    if (plannedMenu.menu_decouverte) result.menu_decouverte = plannedMenu.menu_decouverte;
                    if (plannedMenu.menu_standard) result.menu_standard = plannedMenu.menu_standard;
                    if (plannedMenu.menu_confort) result.menu_confort = plannedMenu.menu_confort;
                    if (plannedMenu.menu_duo) result.menu_duo = plannedMenu.menu_duo;
                }
            } else if (planError) {
                result._plan_error = planError.message;
            }
        }

        const { data: companyData } = await supabase.from('company_settings').select('order_cutoff_days, order_cutoff_hour').limit(1).single();
        const finalSettings = { order_cutoff_days: 2, order_cutoff_hour: 11, ...result, ...companyData };

        return addCorsHeaders(new Response(JSON.stringify(finalSettings), { status: 200, headers: { 'Content-Type': 'application/json' } }), origin);

    } catch (error) {
        return addCorsHeaders(new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } }), origin);
    }
}
