-- Add qualitative insight columns to signals table
ALTER TABLE public.signals 
ADD COLUMN IF NOT EXISTS ai_insight TEXT,
ADD COLUMN IF NOT EXISTS ai_pitch TEXT,
ADD COLUMN IF NOT EXISTS ai_enriched_at TIMESTAMP WITH TIME ZONE;