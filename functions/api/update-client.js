
import { createClient } from '@supabase/supabase-js';

export const onRequestPost = async (context) => {
  const supabase = createClient(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { id, table, ...updates } = await context.request.json();

    if (!id || !table) {
      return new Response(JSON.stringify({ error: 'Missing ID or Table' }), { status: 400 });
    }

    // Secure update using Service Role
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq('id', id)
      .select();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
