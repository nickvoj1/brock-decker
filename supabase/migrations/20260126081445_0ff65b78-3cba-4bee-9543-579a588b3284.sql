-- Create enum for run status
CREATE TYPE public.run_status AS ENUM ('pending', 'running', 'success', 'partial', 'failed');

-- Create table for enrichment runs
CREATE TABLE public.enrichment_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  search_counter INTEGER NOT NULL DEFAULT 1,
  candidates_count INTEGER NOT NULL DEFAULT 0,
  preferences_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  status public.run_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  enriched_csv_url TEXT,
  bullhorn_enabled BOOLEAN NOT NULL DEFAULT false,
  bullhorn_errors JSONB DEFAULT '[]'::jsonb,
  candidates_data JSONB DEFAULT '[]'::jsonb,
  preferences_data JSONB DEFAULT '[]'::jsonb,
  enriched_data JSONB DEFAULT '[]'::jsonb
);

-- Create table for API settings (stored securely)
CREATE TABLE public.api_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  is_configured BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS on both tables
ALTER TABLE public.enrichment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (no auth required for this internal tool)
-- In production, you'd want to add proper authentication
CREATE POLICY "Allow all operations on enrichment_runs"
  ON public.enrichment_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on api_settings"
  ON public.api_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_enrichment_runs_updated_at
  BEFORE UPDATE ON public.enrichment_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_settings_updated_at
  BEFORE UPDATE ON public.api_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings placeholders
INSERT INTO public.api_settings (setting_key, setting_value, is_configured) VALUES
  ('apollo_api_key', '', false),
  ('bullhorn_client_id', '', false),
  ('bullhorn_client_secret', '', false),
  ('bullhorn_username', '', false),
  ('bullhorn_password', '', false);