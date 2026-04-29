
-- 1) feedback_log: drop overly permissive write policy
DROP POLICY IF EXISTS "Allow insert feedback_log" ON public.feedback_log;
-- Keep read policy for dashboard, but require explicit consent (still public read since no auth in app)
-- (intentionally leave "Allow read feedback_log" — UI relies on it)

-- 2) job_signals: remove public UPDATE
DROP POLICY IF EXISTS "Allow update job_signals" ON public.job_signals;

-- 3) signals: remove public UPDATE
DROP POLICY IF EXISTS "Allow update signals" ON public.signals;

-- 4) Revoke EXECUTE on sensitive SECURITY DEFINER functions from anon/public
REVOKE EXECUTE ON FUNCTION public.crm_search_contacts(text, jsonb, integer, integer, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(text, app_role) FROM anon, public;

-- 5) Add search_path to helper functions used by RLS / queries
CREATE OR REPLACE FUNCTION public.crm_contact_field_text(contact bullhorn_client_contacts_mirror, field_name text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.crm_contact_matches_filters(contact bullhorn_client_contacts_mirror, filters jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$;
