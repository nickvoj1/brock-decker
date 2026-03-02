-- Hard-delete consultant profile and all directly linked app records.
-- Target profile: Vadzim Valasevich
-- Run in Supabase SQL editor (service role).

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _profile_cleanup_summary (
  table_name text NOT NULL,
  column_name text NOT NULL,
  deleted_rows bigint NOT NULL,
  remaining_rows bigint NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  target_profile text := 'Vadzim Valasevich';
  r record;
  deleted_count bigint;
  remaining_count bigint;
BEGIN
  FOR r IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN (
        'profile_name',
        'uploaded_by',
        'created_by',
        'dismissed_by',
        'recruiter',
        'requested_by',
        'added_by',
        'user_id'
      )
    ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I WHERE CAST(%I AS text) = $1',
      r.table_schema,
      r.table_name,
      r.column_name
    )
    USING target_profile;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE CAST(%I AS text) = $1',
      r.table_schema,
      r.table_name,
      r.column_name
    )
    INTO remaining_count
    USING target_profile;

    INSERT INTO _profile_cleanup_summary (table_name, column_name, deleted_rows, remaining_rows)
    VALUES (r.table_name, r.column_name, deleted_count, remaining_count);
  END LOOP;
END $$;

SELECT *
FROM _profile_cleanup_summary
ORDER BY deleted_rows DESC, table_name, column_name;

COMMIT;
