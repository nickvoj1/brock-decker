-- Drop the restrictive service_role policy that blocks all non-service updates
DROP POLICY IF EXISTS "Service role only for signals" ON public.signals;

-- Keep the existing permissive policies for read/update
-- These already exist: "Allow read signals" and "Allow update signals"