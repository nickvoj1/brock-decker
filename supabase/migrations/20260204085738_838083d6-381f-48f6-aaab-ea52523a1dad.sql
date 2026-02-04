-- Add new columns to signals table for surge scraper v2.1
ALTER TABLE public.signals 
ADD COLUMN IF NOT EXISTS detected_region text,
ADD COLUMN IF NOT EXISTS validated_region text,
ADD COLUMN IF NOT EXISTS keywords_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS keywords text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS raw_content text,
ADD COLUMN IF NOT EXISTS user_feedback text;

-- Add comment for user_feedback valid values
COMMENT ON COLUMN public.signals.user_feedback IS 'APPROVE | REJECT_NORDIC | REJECT_WRONG_REGION';
COMMENT ON COLUMN public.signals.validated_region IS 'NULL=pending | LONDON | EUROPE | UAE | USA | REJECTED';

-- Create feedback_log table for self-learning
CREATE TABLE IF NOT EXISTS public.feedback_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id uuid REFERENCES public.signals(id) ON DELETE CASCADE,
  recruiter text NOT NULL,
  action text NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on feedback_log
ALTER TABLE public.feedback_log ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for feedback_log (service role only like other tables)
CREATE POLICY "Service role only for feedback_log" 
ON public.feedback_log 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_log_signal_id ON public.feedback_log(signal_id);
CREATE INDEX IF NOT EXISTS idx_signals_validated_region ON public.signals(validated_region);
CREATE INDEX IF NOT EXISTS idx_signals_user_feedback ON public.signals(user_feedback);