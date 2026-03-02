-- Dedicated Bullhorn ClientCorporation mirror + mirrored company notes
-- Keeps company profiles and company-level notes in Supabase for fast CRM reads.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bullhorn_client_corporations_mirror (
  bullhorn_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  last_synced_job_id uuid REFERENCES public.bullhorn_sync_jobs(id) ON DELETE SET NULL,
  name text,
  status text,
  url text,
  phone text,
  industry text,
  address1 text,
  address2 text,
  city text,
  state text,
  country_id integer,
  country_name text,
  owner_id bigint,
  owner_name text,
  date_added timestamptz,
  date_last_modified timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_corporations_name
  ON public.bullhorn_client_corporations_mirror(name);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_corporations_synced
  ON public.bullhorn_client_corporations_mirror(synced_at DESC);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_corporations_modified
  ON public.bullhorn_client_corporations_mirror(date_last_modified DESC);

ALTER TABLE public.bullhorn_client_corporations_mirror ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_client_corporations_mirror'
      AND policyname = 'Service role only for bullhorn_client_corporations_mirror'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_client_corporations_mirror"
      ON public.bullhorn_client_corporations_mirror
      FOR ALL
      USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
      WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_bullhorn_client_corporations_mirror_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_client_corporations_mirror_updated_at
    BEFORE UPDATE ON public.bullhorn_client_corporations_mirror
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bullhorn_company_notes_mirror (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id bigint NOT NULL,
  note_id bigint,
  note_action text,
  note_text text,
  note_date timestamptz,
  person_name text,
  target_entity_name text,
  target_entity_id bigint,
  external_key text NOT NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_job_id uuid REFERENCES public.bullhorn_sync_jobs(id) ON DELETE SET NULL,
  CONSTRAINT uq_bullhorn_company_notes_mirror_external UNIQUE (external_key)
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_company_notes_mirror_company
  ON public.bullhorn_company_notes_mirror(company_id, note_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_bullhorn_company_notes_mirror_note_id
  ON public.bullhorn_company_notes_mirror(note_id);

ALTER TABLE public.bullhorn_company_notes_mirror ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_company_notes_mirror'
      AND policyname = 'Service role only for bullhorn_company_notes_mirror'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_company_notes_mirror"
      ON public.bullhorn_company_notes_mirror
      FOR ALL
      USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
      WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_bullhorn_company_notes_mirror_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_company_notes_mirror_updated_at
    BEFORE UPDATE ON public.bullhorn_company_notes_mirror
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
