-- Create signals table for recruitment intel
CREATE TABLE public.signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT,
  region TEXT NOT NULL CHECK (region IN ('europe', 'uae', 'east_usa', 'west_usa')),
  amount NUMERIC,
  currency TEXT DEFAULT 'EUR',
  signal_type TEXT CHECK (signal_type IN ('funding', 'hiring', 'expansion', 'c_suite', 'team_growth')),
  description TEXT,
  url TEXT,
  source TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  is_high_intent BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_by TEXT,
  contacts_found INTEGER DEFAULT 0,
  cv_matches INTEGER DEFAULT 0,
  bullhorn_note_added BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

-- Service role only policy (accessed via data-api proxy)
CREATE POLICY "Service role only for signals"
ON public.signals
AS RESTRICTIVE
FOR ALL
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- Create indexes for common queries
CREATE INDEX idx_signals_region ON public.signals(region);
CREATE INDEX idx_signals_published_at ON public.signals(published_at DESC);
CREATE INDEX idx_signals_is_dismissed ON public.signals(is_dismissed);
CREATE INDEX idx_signals_is_high_intent ON public.signals(is_high_intent);

-- Trigger for updated_at
CREATE TRIGGER update_signals_updated_at
BEFORE UPDATE ON public.signals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();