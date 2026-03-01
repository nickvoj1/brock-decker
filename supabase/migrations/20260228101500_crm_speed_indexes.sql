-- CRM read-speed optimizations for mirror-first mode.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Fast company detail lookups in mirrored contacts.
CREATE INDEX IF NOT EXISTS idx_bullhorn_contacts_company_active_id_desc
  ON public.bullhorn_client_contacts_mirror(client_corporation_id, is_deleted, bullhorn_id DESC);

-- Fast note timeline lookup for contact drawers.
CREATE INDEX IF NOT EXISTS idx_bullhorn_timeline_contact_note_event_at
  ON public.bullhorn_contact_timeline_events(bullhorn_contact_id, event_source, event_at DESC, id DESC);

-- Fast company-note lookup from local timeline.
CREATE INDEX IF NOT EXISTS idx_bullhorn_timeline_entity_note_event_at
  ON public.bullhorn_contact_timeline_events(entity_id, entity_name, event_source, event_at DESC);

-- Improve distribution list member search with ILIKE.
CREATE INDEX IF NOT EXISTS idx_distribution_list_contacts_name_trgm
  ON public.distribution_list_contacts USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_distribution_list_contacts_email_trgm
  ON public.distribution_list_contacts USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_distribution_list_contacts_company_trgm
  ON public.distribution_list_contacts USING gin (company_name gin_trgm_ops);

