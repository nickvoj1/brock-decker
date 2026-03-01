-- Sync scheduler settings for Bullhorn contact mirror.
-- Allows nightly background sync and lag threshold tracking.

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

CREATE TABLE IF NOT EXISTS public.bullhorn_sync_settings (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  enabled boolean NOT NULL DEFAULT true,
  target_hour_utc integer NOT NULL DEFAULT 2 CHECK (target_hour_utc >= 0 AND target_hour_utc <= 23),
  target_minute_utc integer NOT NULL DEFAULT 0 CHECK (target_minute_utc >= 0 AND target_minute_utc <= 59),
  min_interval_hours integer NOT NULL DEFAULT 20 CHECK (min_interval_hours >= 1 AND min_interval_hours <= 168),
  max_lag_hours integer NOT NULL DEFAULT 24 CHECK (max_lag_hours >= 1 AND max_lag_hours <= 720),
  include_deleted boolean NOT NULL DEFAULT false,
  batch_size integer NOT NULL DEFAULT 500 CHECK (batch_size >= 1 AND batch_size <= 2000),
  max_batches_per_invocation integer NOT NULL DEFAULT 8 CHECK (max_batches_per_invocation >= 1 AND max_batches_per_invocation <= 40),
  last_scheduled_run_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.bullhorn_sync_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bullhorn_sync_settings'
      AND policyname = 'Service role only for bullhorn_sync_settings'
  ) THEN
    CREATE POLICY "Service role only for bullhorn_sync_settings"
      ON public.bullhorn_sync_settings
      FOR ALL
      USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
      WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bullhorn_sync_settings_updated
  ON public.bullhorn_sync_settings(updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_bullhorn_sync_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_bullhorn_sync_settings_updated_at
    BEFORE UPDATE ON public.bullhorn_sync_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

INSERT INTO public.bullhorn_sync_settings (
  id,
  enabled,
  target_hour_utc,
  target_minute_utc,
  min_interval_hours,
  max_lag_hours,
  include_deleted,
  batch_size,
  max_batches_per_invocation,
  metadata
)
VALUES (
  'clientcontacts',
  true,
  2,
  0,
  20,
  24,
  false,
  500,
  8,
  jsonb_build_object('created_by', 'migration')
)
ON CONFLICT (id) DO NOTHING;
