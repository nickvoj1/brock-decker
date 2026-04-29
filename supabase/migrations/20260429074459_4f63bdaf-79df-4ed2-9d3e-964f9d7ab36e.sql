CREATE TABLE IF NOT EXISTS public.apollo_combo_yield (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry text NOT NULL,
  sector text,
  region text,
  contacts_added integer NOT NULL DEFAULT 0,
  combos_run integer NOT NULL DEFAULT 0,
  pages_scanned integer NOT NULL DEFAULT 0,
  last_run_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS apollo_combo_yield_unique
  ON public.apollo_combo_yield (
    lower(industry),
    coalesce(lower(sector), ''),
    coalesce(lower(region), '')
  );

CREATE INDEX IF NOT EXISTS apollo_combo_yield_score_idx
  ON public.apollo_combo_yield (contacts_added DESC, last_run_at DESC);

ALTER TABLE public.apollo_combo_yield ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for apollo_combo_yield"
  ON public.apollo_combo_yield
  FOR ALL
  USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
  WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE TRIGGER update_apollo_combo_yield_updated_at
BEFORE UPDATE ON public.apollo_combo_yield
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();