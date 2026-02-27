-- Distribution Lists for CRM contact grouping (read-only relative to Bullhorn).
-- Stores internal list membership against mirrored Bullhorn contacts.

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

CREATE TABLE IF NOT EXISTS public.distribution_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  created_by text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_distribution_lists_name_lower
  ON public.distribution_lists ((lower(name)));

ALTER TABLE public.distribution_lists ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'distribution_lists'
      AND policyname = 'Service role only for distribution_lists'
  ) THEN
    CREATE POLICY "Service role only for distribution_lists"
      ON public.distribution_lists
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
    WHERE tgname = 'update_distribution_lists_updated_at'
  ) THEN
    CREATE TRIGGER update_distribution_lists_updated_at
    BEFORE UPDATE ON public.distribution_lists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.distribution_list_contacts (
  list_id uuid NOT NULL REFERENCES public.distribution_lists(id) ON DELETE CASCADE,
  bullhorn_id bigint NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by text NOT NULL,
  name text,
  email text,
  occupation text,
  company_name text,
  contact_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (list_id, bullhorn_id)
);

CREATE INDEX IF NOT EXISTS idx_distribution_list_contacts_list_added
  ON public.distribution_list_contacts(list_id, added_at DESC);

CREATE INDEX IF NOT EXISTS idx_distribution_list_contacts_company
  ON public.distribution_list_contacts(company_name);

CREATE INDEX IF NOT EXISTS idx_distribution_list_contacts_email
  ON public.distribution_list_contacts(email);

ALTER TABLE public.distribution_list_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'distribution_list_contacts'
      AND policyname = 'Service role only for distribution_list_contacts'
  ) THEN
    CREATE POLICY "Service role only for distribution_list_contacts"
      ON public.distribution_list_contacts
      FOR ALL
      USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
      WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);
  END IF;
END $$;
