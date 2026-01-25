-- Ajoute la colonne storage_path aux tables quotes et invoices
-- pour stocker le chemin vers le fichier PDF dans Supabase Storage.

ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS storage_path TEXT;
