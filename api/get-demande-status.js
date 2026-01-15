import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// This function will be deployed as a Vercel serverless function.
export default async (req, res) => {
    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // Use Vercel's query parameter parsing
        const { id } = req.query;

        if (!id || typeof id !== 'string' || id.length !== 8) {
            return res.status(400).json({ error: 'A valid 8-character request ID is required.' });
        }

        // Initialize Supabase client
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // Call the custom SQL function to find the demand by its short ID
        const { data, error } = await supabase
            .from('demandes_with_text_id')
            .select('id, created_at, type, status')
            .ilike('id_text', `${id}%`)
            .limit(1)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // "Not a single row was found" in PostgREST
                return res.status(404).json({ error: 'Request not found.' });
            }
            // For other database errors, re-throw to be caught by the generic error handler
            throw error;
        }
        
        // Return only the non-sensitive data
        return res.status(200).json(data);

    } catch (error) {
        console.error('Error fetching demand status:', error.message);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};
