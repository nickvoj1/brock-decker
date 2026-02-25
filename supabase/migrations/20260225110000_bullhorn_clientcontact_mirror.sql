-- Bullhorn ClientContact mirror + sync job tracking
-- IMPORTANT: This schema is read-only with respect to Bullhorn itself.
-- We only mirror Bullhorn data into Supabase.

CREATE TABLE IF NOT EXISTS public.bullhorn_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  requested_by text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  batch_size integer NOT NULL DEFAULT 500 CHECK (batch_size >= 50 AND batch_size <= 2000),
  include_deleted boolean NOT NULL DEFAULT false,
  next_start integer NOT NULL DEFAULT 0 CHECK (next_start >= 0),
  total_expected integer,
  total_synced integer NOT NULL DEFAULT 0 CHECK (total_synced >= 0),
  batches_processed integer NOT NULL DEFAULT 0 CHECK (batches_processed >= 0),
  last_batch_size integer NOT NULL DEFAULT 0 CHECK (last_batch_size >= 0),
  started_at timestamptz,
  finished_at timestamptz,
  heartbeat_at timestamptz,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.bullhorn_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for bullhorn_sync_jobs"
ON public.bullhorn_sync_jobs
FOR ALL
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_bullhorn_sync_jobs_created
  ON public.bullhorn_sync_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bullhorn_sync_jobs_status
  ON public.bullhorn_sync_jobs(status, updated_at DESC);

CREATE TRIGGER update_bullhorn_sync_jobs_updated_at
BEFORE UPDATE ON public.bullhorn_sync_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.bullhorn_client_contacts_mirror (
  bullhorn_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  last_synced_job_id uuid REFERENCES public.bullhorn_sync_jobs(id) ON DELETE SET NULL,
  name text,
  first_name text,
  last_name text,
  email text,
  email_normalized text,
  occupation text,
  status text,
  phone text,
  mobile text,
  address_city text,
  address_state text,
  address_country_id integer,
  client_corporation_id bigint,
  client_corporation_name text,
  owner_id bigint,
  owner_name text,
  date_added timestamptz,
  date_last_modified timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.bullhorn_client_contacts_mirror ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for bullhorn_client_contacts_mirror"
ON public.bullhorn_client_contacts_mirror
FOR ALL
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_email_norm
  ON public.bullhorn_client_contacts_mirror(email_normalized);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_company
  ON public.bullhorn_client_contacts_mirror(client_corporation_name);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_synced
  ON public.bullhorn_client_contacts_mirror(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_last_modified
  ON public.bullhorn_client_contacts_mirror(date_last_modified DESC);

CREATE TRIGGER update_bullhorn_client_contacts_mirror_updated_at
BEFORE UPDATE ON public.bullhorn_client_contacts_mirror
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
