-- Per-source run telemetry for signal pipelines (used for source quality ranking).
CREATE TABLE IF NOT EXISTS public.signal_source_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  pipeline text NOT NULL,
  region text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  candidates integer NOT NULL DEFAULT 0,
  geo_validated integer NOT NULL DEFAULT 0,
  quality_passed integer NOT NULL DEFAULT 0,
  inserted integer NOT NULL DEFAULT 0,
  rejected integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  pending integer NOT NULL DEFAULT 0,
  validated integer NOT NULL DEFAULT 0,
  avg_geo_confidence numeric NOT NULL DEFAULT 0
);

ALTER TABLE public.signal_source_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for signal_source_runs"
ON public.signal_source_runs
FOR ALL
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_signal_source_runs_created
  ON public.signal_source_runs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_source_runs_pipeline_region
  ON public.signal_source_runs(pipeline, region, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_source_runs_source
  ON public.signal_source_runs(source_name, source_url, created_at DESC);

CREATE TRIGGER update_signal_source_runs_updated_at
BEFORE UPDATE ON public.signal_source_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
