-- Add Bullhorn export tracking columns to enrichment_runs
ALTER TABLE public.enrichment_runs 
ADD COLUMN IF NOT EXISTS bullhorn_list_name TEXT,
ADD COLUMN IF NOT EXISTS bullhorn_list_id INTEGER,
ADD COLUMN IF NOT EXISTS bullhorn_exported_at TIMESTAMP WITH TIME ZONE;