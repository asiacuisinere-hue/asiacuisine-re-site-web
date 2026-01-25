import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Gérer la requête de pré-vérification (preflight) CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authentifier l'utilisateur via l'en-tête Authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Authentication failed');
    }

    // 2. Récupérer le chemin du fichier depuis l'URL
    const url = new URL(req.url);
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      throw new Error('Missing file path parameter');
    }

    // 3. Créer un client admin pour télécharger le fichier
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Télécharger le fichier depuis le stockage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('documents')
      .download(filePath);
    
    if (downloadError) {
      throw downloadError;
    }

    // 5. Renvoyer le fichier avec les bons en-têtes
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `inline; filename="${filePath.split('/').pop()}"`);

                return new Response(fileData, { headers });
  } catch (error) {
    console.error('Error in view-document:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})