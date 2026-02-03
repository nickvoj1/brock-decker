-- Create signal_feedback table for training/retraining the AI classifier
CREATE TABLE public.signal_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id UUID NOT NULL REFERENCES public.signals(id) ON DELETE CASCADE,
  user_label TEXT NOT NULL, -- e.g., 'tier_1', 'tier_2', 'tier_3', 'irrelevant'
  correct_tier TEXT, -- User-corrected tier if AI was wrong
  correct_signal_type TEXT, -- User-corrected signal type
  confidence_delta NUMERIC DEFAULT 0, -- How much accuracy improved/decreased
  feedback_note TEXT, -- Optional user notes
  created_by TEXT NOT NULL, -- Profile name
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_signal_feedback_signal_id ON public.signal_feedback(signal_id);
CREATE INDEX idx_signal_feedback_created_at ON public.signal_feedback(created_at DESC);

-- Create signal_accuracy_metrics table for tracking model performance over time
CREATE TABLE public.signal_accuracy_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  region TEXT NOT NULL,
  total_signals INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy_percentage NUMERIC DEFAULT 0,
  tier_1_accuracy NUMERIC DEFAULT 0,
  tier_2_accuracy NUMERIC DEFAULT 0,
  tier_3_accuracy NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(date, region)
);

-- Add retrain_flag and confidence columns to signals table
ALTER TABLE public.signals 
ADD COLUMN IF NOT EXISTS retrain_flag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback_count INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.signal_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_accuracy_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies for signal_feedback
CREATE POLICY "Service role only for signal_feedback" 
ON public.signal_feedback 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- RLS policies for signal_accuracy_metrics
CREATE POLICY "Service role only for signal_accuracy_metrics" 
ON public.signal_accuracy_metrics 
FOR ALL 
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);