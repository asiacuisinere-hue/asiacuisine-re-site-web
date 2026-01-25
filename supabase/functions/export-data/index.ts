import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Fonction utilitaire pour échapper les champs CSV
const escapeCsvField = (field: any): string => {
  if (field === null || field === undefined) {
    return '';
  }
  const stringField = String(field);
  // Si le champ contient une virgule, des guillemets ou un retour à la ligne, l'entourer de guillemets
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    // Remplacer les guillemets existants par des guillemets doubles
    const escapedField = stringField.replace(/"/g, '""');
    return `"${escapedField}"`;
  }
  return stringField;
};

// Fonction pour convertir un tableau d'objets JSON en CSV
const jsonToCsv = (jsonData: any[], columns: { key: string, title: string }[]): string => {
  // Créer l'en-tête CSV
  const header = columns.map(c => c.title).join(',');
  
  // Créer les lignes de données
  const rows = jsonData.map(row => {
    return columns.map(c => escapeCsvField(row[c.key])).join(',');
  });
  
  return [header, ...rows].join('\n');
};

serve(async (req) => {
  // Gestion de la requête pre-flight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders, status: 200 });
  }

  try {
    // Création du client Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );

    // Récupération des paramètres de date depuis l'URL
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Les paramètres startDate et endDate sont requis.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Récupérer les données des commandes (demandes)
    const { data: demandes, error: demandesError } = await supabaseAdmin
      .from('demandes')
      .select('id, created_at, type, status, details_json, clients(first_name, last_name, email, phone, type)')
      .gte('created_at', startDate)
      .lte('created_at', `${endDate}T23:59:59`); // Inclure toute la journée de fin

    if (demandesError) throw demandesError;

    // 2. Récupérer les données des dépenses
    const { data: depenses, error: depensesError } = await supabaseAdmin
      .from('expenses')
      .select('id, expense_date, description, category, amount')
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (depensesError) throw depensesError;

    // 3. Convertir les données en CSV
    const demandesCsv = jsonToCsv(demandes.map(d => ({
        id: d.id,
        date_creation: d.created_at,
        type_demande: d.type,
        statut: d.status,
        total: d.details_json?.total,
        client_nom: d.clients?.last_name,
        client_prenom: d.clients?.first_name,
        client_email: d.clients?.email,
        client_telephone: d.clients?.phone,
        details: JSON.stringify(d.details_json),
    })), [
      { key: 'id', title: 'ID Demande' },
      { key: 'date_creation', title: 'Date' },
      { key: 'type_demande', title: 'Type' },
      { key: 'statut', title: 'Statut' },
      { key: 'total', title: 'Total (€)' },
      { key: 'client_nom', title: 'Nom Client' },
      { key: 'client_prenom', title: 'Prénom Client' },
      { key: 'client_email', title: 'Email Client' },
      { key: 'client_telephone', title: 'Téléphone Client' },
      { key: 'details', title: 'Détails' },
    ]);

    const depensesCsv = jsonToCsv(depenses, [
      { key: 'id', title: 'ID Dépense' },
      { key: 'expense_date', title: 'Date' },
      { key: 'description', title: 'Description' },
      { key: 'category', title: 'Catégorie' },
      { key: 'amount', title: 'Montant (€)' },
    ]);

    // Combiner les CSV en un seul fichier ou les renvoyer séparément
    // Pour cet exemple, nous allons créer un super CSV avec les deux sections.
    const combinedCsv = `## COMMANDES\n${demandesCsv}\n\n## DEPENSES\n${depensesCsv}`;

    // Renvoyer le CSV
    return new Response(combinedCsv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="export_${startDate}_au_${endDate}.csv"`,
      },
    });

  } catch (error) {
    console.error('Erreur inattendue:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});