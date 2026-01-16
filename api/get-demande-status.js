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
        // Utilisez 'shortId' au lieu de 'id' pour éviter le conflit avec la colonne UUID
        const { id: shortId } = req.query;

        if (!shortId || typeof shortId !== 'string' || shortId.length !== 8) {
            return res.status(400).json({ error: 'A valid 8-character request ID is required.' });
        }

        const supabase = createClient(
            process.env.SUPABASE_URL, 
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        // Query la vue avec seulement les colonnes nécessaires
        const { data, error } = await supabase
            .from('demandes_lookup')
            .select('short_id, created_at, type, status')
            .like('short_id', `${shortId.toLowerCase()}%`)
            .limit(1)
            .single();

        if (error) {
            console.error('Error fetching demand status:', error);
            
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Request not found.' });
            }
            
            throw error;
        }
        
        if (!data) {
            return res.status(404).json({ error: 'Request not found.' });
        }

        // Renommez short_id en id dans la réponse pour la compatibilité frontend
        const response = {
            id: data.short_id,
            created_at: data.created_at,
            type: data.type,
            status: data.status
        };
        
        return res.status(200).json(response);

    } catch (error) {
        console.error('Error fetching demand status:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
};