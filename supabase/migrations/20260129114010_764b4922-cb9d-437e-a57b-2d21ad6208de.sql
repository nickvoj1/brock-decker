-- Fix RLS policies for sensitive tables
-- These tables should ONLY be accessible via service role (edge functions)

-- 1. Fix api_settings (stores Apollo API key, Bullhorn credentials)
DROP POLICY IF EXISTS "Allow all operations on api_settings" ON public.api_settings;

CREATE POLICY "Service role only for api_settings"
  ON public.api_settings FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- 2. Fix bullhorn_tokens (stores OAuth tokens)
DROP POLICY IF EXISTS "Allow all operations on bullhorn_tokens" ON public.bullhorn_tokens;

CREATE POLICY "Service role only for bullhorn_tokens"
  ON public.bullhorn_tokens FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- 3. Fix candidate_profiles (contains PII - name, email, phone)
DROP POLICY IF EXISTS "Allow all operations on candidate_profiles" ON public.candidate_profiles;

CREATE POLICY "Service role only for candidate_profiles"
  ON public.candidate_profiles FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- 4. Fix enrichment_runs (contains business data)
DROP POLICY IF EXISTS "Allow all operations on enrichment_runs" ON public.enrichment_runs;

CREATE POLICY "Service role only for enrichment_runs"
  ON public.enrichment_runs FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- 5. Fix generated_pitches
DROP POLICY IF EXISTS "Allow all operations on generated_pitches" ON public.generated_pitches;

CREATE POLICY "Service role only for generated_pitches"
  ON public.generated_pitches FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- 6. Fix pitch_templates
DROP POLICY IF EXISTS "Allow all operations on pitch_templates" ON public.pitch_templates;

CREATE POLICY "Service role only for pitch_templates"
  ON public.pitch_templates FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- 7. Fix used_contacts (contains PII - email, name, company)
DROP POLICY IF EXISTS "Allow all operations on used_contacts" ON public.used_contacts;

CREATE POLICY "Service role only for used_contacts"
  ON public.used_contacts FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- 8. Update profile_pins - keep verification functions working but lock down hash access
-- Current policies are fine for basic operations but pin_hash should only be readable by service role
DROP POLICY IF EXISTS "Allow checking if profile has PIN" ON public.profile_pins;
DROP POLICY IF EXISTS "Allow setting PIN" ON public.profile_pins;
DROP POLICY IF EXISTS "Allow updating PIN" ON public.profile_pins;
DROP POLICY IF EXISTS "Admins can reset PINs" ON public.profile_pins;

-- Only service role can access profile_pins (edge function handles all PIN operations)
CREATE POLICY "Service role only for profile_pins"
  ON public.profile_pins FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');

-- Add salt column to profile_pins for per-user salt (improved hashing)
ALTER TABLE public.profile_pins ADD COLUMN IF NOT EXISTS salt TEXT;