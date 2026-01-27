-- Add uploaded_by column to enrichment_runs to track which user created each run
ALTER TABLE public.enrichment_runs 
ADD COLUMN uploaded_by text;