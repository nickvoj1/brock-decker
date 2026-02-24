-- Remove existing duplicates by dedupe key, keeping the newest record.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY lower(btrim(coalesce(details->>'dedupe_key', '')))
      ORDER BY published_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS rn
  FROM public.signals
  WHERE btrim(coalesce(details->>'dedupe_key', '')) <> ''
)
DELETE FROM public.signals s
USING ranked r
WHERE s.id = r.id
  AND r.rn > 1;

-- Enforce dedupe at DB level for all future inserts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_signals_dedupe_key_unique
ON public.signals ((lower(btrim(coalesce(details->>'dedupe_key', '')))))
WHERE btrim(coalesce(details->>'dedupe_key', '')) <> '';