-- Fix user_roles table - restrict all operations to service_role
-- Since admin checks go through edge functions, lock it down completely

DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Anyone can check roles" ON public.user_roles;

-- Service role only - edge functions handle admin authorization
CREATE POLICY "Service role only for user_roles"
  ON public.user_roles FOR ALL
  USING ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role')
  WITH CHECK ((current_setting('request.jwt.claims', true)::json ->> 'role') = 'service_role');