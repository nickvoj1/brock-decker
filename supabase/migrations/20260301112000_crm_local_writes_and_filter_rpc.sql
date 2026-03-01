-- Local-write CRM tables + DB-side contact filter RPC for large datasets.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

CREATE TABLE IF NOT EXISTS public.bullhorn_company_local_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  company_id bigint NOT NULL,
  note_label text NOT NULL DEFAULT 'Local CRM Note',
  note_text text NOT NULL,
  created_by text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bullhorn_company_local_notes_company
  ON public.bullhorn_company_local_notes(company_id, created_at DESC);

ALTER TABLE public.bullhorn_company_local_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_company_local_notes'
      AND policyname = 'Service role only for bullhorn_company_local_notes'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_company_local_notes"
      ON public.bullhorn_company_local_notes
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
    WHERE tgname = 'update_bullhorn_company_local_notes_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_company_local_notes_updated_at
    BEFORE UPDATE ON public.bullhorn_company_local_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.distribution_list_events (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  list_id uuid NOT NULL REFERENCES public.distribution_lists(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  created_by text NOT NULL,
  note_text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_distribution_list_events_list_created
  ON public.distribution_list_events(list_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distribution_list_events_type_created
  ON public.distribution_list_events(event_type, created_at DESC);

ALTER TABLE public.distribution_list_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'distribution_list_events'
      AND policyname = 'Service role only for distribution_list_events'
  ) THEN
    CREATE POLICY "Service role only for distribution_list_events"
      ON public.distribution_list_events
      FOR ALL
      USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
      WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_name_trgm
  ON public.bullhorn_client_contacts_mirror USING gin (coalesce(name, '') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_email_trgm
  ON public.bullhorn_client_contacts_mirror USING gin (coalesce(email, '') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_company_trgm
  ON public.bullhorn_client_contacts_mirror USING gin (coalesce(client_corporation_name, '') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_occupation_trgm
  ON public.bullhorn_client_contacts_mirror USING gin (coalesce(occupation, '') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_city_trgm
  ON public.bullhorn_client_contacts_mirror USING gin (coalesce(address_city, '') gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bullhorn_client_contacts_status_id
  ON public.bullhorn_client_contacts_mirror(status, bullhorn_id DESC);

CREATE OR REPLACE FUNCTION public.crm_contact_field_text(
  contact public.bullhorn_client_contacts_mirror,
  field_name text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  f text := lower(coalesce(field_name, ''));
BEGIN
  CASE f
    WHEN 'name' THEN RETURN coalesce(contact.name, '');
    WHEN 'company' THEN RETURN coalesce(contact.client_corporation_name, '');
    WHEN 'title' THEN RETURN coalesce(contact.occupation, '');
    WHEN 'email' THEN RETURN coalesce(contact.email, '');
    WHEN 'city' THEN RETURN coalesce(contact.address_city, '');
    WHEN 'country' THEN
      RETURN coalesce(contact.raw #>> '{address,countryName}', contact.raw ->> 'countryName', '');
    WHEN 'consultant' THEN RETURN coalesce(contact.owner_name, '');
    WHEN 'status' THEN RETURN coalesce(contact.status, '');
    WHEN 'skills' THEN
      RETURN trim(
        coalesce(contact.raw ->> 'skills', '') || ' ' ||
        coalesce(contact.custom_field_summary::text, '') || ' ' ||
        coalesce(contact.raw::text, '')
      );
    WHEN 'preferred_contact' THEN RETURN coalesce(contact.preferred_contact, '');
    WHEN 'comm_status' THEN RETURN coalesce(contact.comm_status_label, '');
    WHEN 'last_contacted' THEN RETURN coalesce(contact.last_contacted_at::text, '');
    WHEN 'has_resume' THEN RETURN CASE WHEN contact.has_resume THEN 'true' ELSE 'false' END;
    WHEN 'mass_mail_opt_out' THEN RETURN CASE WHEN contact.mass_mail_opt_out THEN 'true' ELSE 'false' END;
    ELSE RETURN '';
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_contact_matches_filters(
  contact public.bullhorn_client_contacts_mirror,
  filters jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  filter_row jsonb;
  value_item text;
  row_field text;
  row_operator text;
  row_values jsonb;
  row_matched boolean;
  field_value text;
BEGIN
  IF filters IS NULL OR jsonb_typeof(filters) <> 'array' OR jsonb_array_length(filters) = 0 THEN
    RETURN true;
  END IF;

  FOR filter_row IN SELECT * FROM jsonb_array_elements(filters)
  LOOP
    row_field := lower(coalesce(filter_row ->> 'field', ''));
    row_operator := lower(coalesce(filter_row ->> 'operator', 'contains'));
    row_values := filter_row -> 'values';
    row_matched := false;

    IF row_field = '' THEN
      CONTINUE;
    END IF;
    IF row_values IS NULL OR jsonb_typeof(row_values) <> 'array' OR jsonb_array_length(row_values) = 0 THEN
      CONTINUE;
    END IF;

    field_value := lower(public.crm_contact_field_text(contact, row_field));

    FOR value_item IN SELECT trim(value) FROM jsonb_array_elements_text(row_values) AS t(value)
    LOOP
      IF value_item = '' THEN
        CONTINUE;
      END IF;

      IF row_operator = 'equals' THEN
        IF field_value = lower(value_item) THEN
          row_matched := true;
          EXIT;
        END IF;
      ELSE
        IF position(lower(value_item) in field_value) > 0 THEN
          row_matched := true;
          EXIT;
        END IF;
      END IF;
    END LOOP;

    IF NOT row_matched THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_search_contacts(
  p_search text DEFAULT NULL,
  p_filters jsonb DEFAULT '[]'::jsonb,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0,
  p_exclude_archived boolean DEFAULT true
)
RETURNS TABLE(contact jsonb, total_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH filtered AS (
    SELECT m.*
    FROM public.bullhorn_client_contacts_mirror m
    WHERE
      (NOT p_exclude_archived OR coalesce(m.status, '') !~* 'archiv')
      AND (
        coalesce(trim(p_search), '') = ''
        OR coalesce(m.name, '') ILIKE '%' || p_search || '%'
        OR coalesce(m.email, '') ILIKE '%' || p_search || '%'
        OR coalesce(m.client_corporation_name, '') ILIKE '%' || p_search || '%'
        OR coalesce(m.occupation, '') ILIKE '%' || p_search || '%'
        OR coalesce(m.address_city, '') ILIKE '%' || p_search || '%'
      )
      AND public.crm_contact_matches_filters(m, coalesce(p_filters, '[]'::jsonb))
    ORDER BY m.bullhorn_id DESC
  ),
  paged AS (
    SELECT f.*, count(*) OVER() AS total_count
    FROM filtered f
    OFFSET greatest(p_offset, 0)
    LIMIT greatest(least(p_limit, 200), 1)
  )
  SELECT to_jsonb(paged) - 'total_count', paged.total_count
  FROM paged;
END;
$$;
