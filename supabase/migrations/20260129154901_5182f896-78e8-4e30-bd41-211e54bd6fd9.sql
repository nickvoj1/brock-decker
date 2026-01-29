-- Drop the security definer view and recreate without security definer
DROP VIEW IF EXISTS public.team_dashboard_stats;

-- Recreate view with SECURITY INVOKER (default, but explicit for clarity)
CREATE VIEW public.team_dashboard_stats 
WITH (security_invoker = true) AS
SELECT 
  profile_name,
  COUNT(*) as total_cvs,
  COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as cvs_today,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as cvs_week,
  ROUND(AVG(match_score)::numeric, 2) as avg_score,
  SUM(apollo_contacts_count) as total_apollo_contacts,
  COUNT(*) FILTER (WHERE bullhorn_status = 'uploaded') as bullhorn_uploaded,
  COUNT(*) FILTER (WHERE bullhorn_status = 'pending') as bullhorn_pending,
  COUNT(*) FILTER (WHERE bullhorn_status = 'error') as bullhorn_error
FROM public.candidate_profiles
GROUP BY profile_name;