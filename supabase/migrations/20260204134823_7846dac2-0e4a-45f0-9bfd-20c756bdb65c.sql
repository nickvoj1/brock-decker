-- Create job_signals table to store Apollo job postings with hiring manager contacts
CREATE TABLE public.job_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL,
  company_apollo_id TEXT,
  job_title TEXT NOT NULL,
  job_description TEXT,
  job_url TEXT,
  location TEXT,
  region TEXT NOT NULL CHECK (region IN ('london', 'europe', 'uae', 'usa')),
  posted_at TIMESTAMP WITH TIME ZONE,
  -- Hiring manager contacts (JSON array)
  contacts JSONB DEFAULT '[]'::jsonb,
  contacts_count INTEGER DEFAULT 0,
  -- Scoring and classification
  score INTEGER DEFAULT 50,
  tier TEXT CHECK (tier IN ('tier_1', 'tier_2', 'tier_3')),
  signal_type TEXT DEFAULT 'hiring',
  -- Source tracking
  source TEXT DEFAULT 'apollo_jobs',
  parent_signal_id UUID REFERENCES public.signals(id) ON DELETE SET NULL,
  -- Status tracking
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_by TEXT,
  bullhorn_note_added BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_signals ENABLE ROW LEVEL SECURITY;

-- Allow read access for all
CREATE POLICY "Allow read job_signals"
ON public.job_signals
FOR SELECT
USING (true);

-- Allow update access for all (for dismissing, marking bullhorn)
CREATE POLICY "Allow update job_signals"
ON public.job_signals
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Service role can do everything
CREATE POLICY "Service role only for job_signals"
ON public.job_signals
FOR ALL
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- Create index for fast lookups
CREATE INDEX idx_job_signals_region ON public.job_signals(region);
CREATE INDEX idx_job_signals_company ON public.job_signals(company);
CREATE INDEX idx_job_signals_created ON public.job_signals(created_at DESC);
CREATE UNIQUE INDEX idx_job_signals_unique ON public.job_signals(company, job_title, COALESCE(job_url, ''));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_signals_updated_at
BEFORE UPDATE ON public.job_signals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for job_signals
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_signals;