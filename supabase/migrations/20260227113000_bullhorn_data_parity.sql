-- Bullhorn data parity foundation: normalized contact parity fields + timeline/comms/documents/custom field dictionary.

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

ALTER TABLE public.bullhorn_client_contacts_mirror
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS work_phone_secondary text,
  ADD COLUMN IF NOT EXISTS preferred_contact text,
  ADD COLUMN IF NOT EXISTS mass_mail_opt_out boolean,
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean,
  ADD COLUMN IF NOT EXISTS do_not_contact boolean,
  ADD COLUMN IF NOT EXISTS email_bounced boolean,
  ADD COLUMN IF NOT EXISTS comm_status_label text,
  ADD COLUMN IF NOT EXISTS last_email_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS timeline_event_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS documents_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_resume boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_field_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_last_contacted
  ON public.bullhorn_client_contacts_mirror(last_contacted_at DESC);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_comm_status
  ON public.bullhorn_client_contacts_mirror(comm_status_label);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_preferred_contact
  ON public.bullhorn_client_contacts_mirror(preferred_contact);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_has_resume
  ON public.bullhorn_client_contacts_mirror(has_resume);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_mass_mail_opt_out
  ON public.bullhorn_client_contacts_mirror(mass_mail_opt_out);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_email_bounced
  ON public.bullhorn_client_contacts_mirror(email_bounced);

CREATE TABLE IF NOT EXISTS public.bullhorn_contact_timeline_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  bullhorn_contact_id bigint NOT NULL,
  event_source text NOT NULL,
  event_type text NOT NULL,
  event_at timestamptz,
  summary text,
  details text,
  actor_name text,
  entity_name text,
  entity_id bigint,
  external_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_job_id uuid REFERENCES public.bullhorn_sync_jobs(id) ON DELETE SET NULL,
  CONSTRAINT uq_bullhorn_contact_timeline_external UNIQUE (external_key)
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_contact_timeline_contact_event_at
  ON public.bullhorn_contact_timeline_events(bullhorn_contact_id, event_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_bullhorn_contact_timeline_source
  ON public.bullhorn_contact_timeline_events(event_source, event_at DESC);

ALTER TABLE public.bullhorn_contact_timeline_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_contact_timeline_events'
      AND policyname = 'Service role only for bullhorn_contact_timeline_events'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_contact_timeline_events"
      ON public.bullhorn_contact_timeline_events
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
    WHERE tgname = 'update_bullhorn_contact_timeline_events_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_contact_timeline_events_updated_at
    BEFORE UPDATE ON public.bullhorn_contact_timeline_events
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bullhorn_contact_comms_status (
  bullhorn_contact_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  email_primary text,
  email_secondary text,
  preferred_contact text,
  mass_mail_opt_out boolean,
  sms_opt_in boolean,
  do_not_contact boolean,
  email_bounced boolean,
  status_label text,
  last_email_received_at timestamptz,
  last_email_sent_at timestamptz,
  last_call_at timestamptz,
  last_task_at timestamptz,
  last_note_at timestamptz,
  last_contacted_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_job_id uuid REFERENCES public.bullhorn_sync_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_contact_comms_last_contacted
  ON public.bullhorn_contact_comms_status(last_contacted_at DESC);

ALTER TABLE public.bullhorn_contact_comms_status ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_contact_comms_status'
      AND policyname = 'Service role only for bullhorn_contact_comms_status'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_contact_comms_status"
      ON public.bullhorn_contact_comms_status
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
    WHERE tgname = 'update_bullhorn_contact_comms_status_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_contact_comms_status_updated_at
    BEFORE UPDATE ON public.bullhorn_contact_comms_status
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bullhorn_contact_documents (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  bullhorn_contact_id bigint NOT NULL,
  bullhorn_file_id bigint,
  file_name text,
  file_type text,
  content_type text,
  file_size bigint,
  is_resume boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  date_added timestamptz,
  date_last_modified timestamptz,
  external_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_job_id uuid REFERENCES public.bullhorn_sync_jobs(id) ON DELETE SET NULL,
  CONSTRAINT uq_bullhorn_contact_documents_external UNIQUE (external_key)
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_contact_documents_contact
  ON public.bullhorn_contact_documents(bullhorn_contact_id, date_last_modified DESC, id DESC);

ALTER TABLE public.bullhorn_contact_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_contact_documents'
      AND policyname = 'Service role only for bullhorn_contact_documents'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_contact_documents"
      ON public.bullhorn_contact_documents
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
    WHERE tgname = 'update_bullhorn_contact_documents_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_contact_documents_updated_at
    BEFORE UPDATE ON public.bullhorn_contact_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.bullhorn_custom_field_dictionary (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  entity_name text NOT NULL,
  field_name text NOT NULL,
  field_label text,
  data_type text,
  field_type text,
  required boolean,
  hidden boolean,
  is_custom boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_job_id uuid REFERENCES public.bullhorn_sync_jobs(id) ON DELETE SET NULL,
  CONSTRAINT uq_bullhorn_custom_field_dictionary UNIQUE (entity_name, field_name)
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_custom_field_dictionary_entity
  ON public.bullhorn_custom_field_dictionary(entity_name, is_custom, field_name);

ALTER TABLE public.bullhorn_custom_field_dictionary ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_custom_field_dictionary'
      AND policyname = 'Service role only for bullhorn_custom_field_dictionary'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_custom_field_dictionary"
      ON public.bullhorn_custom_field_dictionary
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
    WHERE tgname = 'update_bullhorn_custom_field_dictionary_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_custom_field_dictionary_updated_at
    BEFORE UPDATE ON public.bullhorn_custom_field_dictionary
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
