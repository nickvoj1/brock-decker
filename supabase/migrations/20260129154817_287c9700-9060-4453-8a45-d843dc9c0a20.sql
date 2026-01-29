-- Add team tracking columns to candidate_profiles if not exists
ALTER TABLE public.candidate_profiles 
ADD COLUMN IF NOT EXISTS apollo_contacts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bullhorn_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS match_score NUMERIC(5,2) DEFAULT 0;

-- Create a view for team dashboard aggregation
CREATE OR REPLACE VIEW public.team_dashboard_stats AS
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

-- Grant service role access to the view
GRANT SELECT ON public.team_dashboard_stats TO service_role;