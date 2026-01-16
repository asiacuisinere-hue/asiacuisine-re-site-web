import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

export default async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        const { id } = req.query;

        if (!id || typeof id !== 'string' || id.length !== 8) {
            return res.status(400).json({ error: 'A valid 8-character request ID is required.' });
        }

        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

        // Ne sélectionnez PAS la colonne 'id' (UUID) - seulement id_text
        const { data, error } = await supabase
            .from('demandes_with_text_id')
            .select('id_text, created_at, type, status')
            .ilike('id_text', `${id}%`)
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching demand status:', error);
            
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Request not found.' });
            }
            
            throw error;
        }
        
        // Si la donnée est null (cas où .single() ne trouve rien et ne retourne pas d'erreur PGRST116)
        if (!data) {
            return res.status(404).json({ error: 'Request not found.' });
        }

        // Renommez id_text en id dans la réponse pour la compatibilité frontend
        const response = {
            id: data.id_text,
            created_at: data.created_at,
            type: data.type,
            status: data.status
        };
        
        return res.status(200).json(response);

    } catch (error) {
        console.error('Error fetching demand status:', error.message);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
};