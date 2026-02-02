-- Create skill_patterns table to store learned skill mappings from Bullhorn analysis
CREATE TABLE public.skill_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('company', 'title', 'location')),
  pattern_value TEXT NOT NULL,
  skills TEXT[] NOT NULL DEFAULT '{}',
  frequency INTEGER NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL DEFAULT 0,
  last_analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on pattern_type + pattern_value
CREATE UNIQUE INDEX idx_skill_patterns_unique ON public.skill_patterns(pattern_type, pattern_value);

-- Create index for fast lookups by pattern type
CREATE INDEX idx_skill_patterns_type ON public.skill_patterns(pattern_type);

-- Create index for confidence-based queries
CREATE INDEX idx_skill_patterns_confidence ON public.skill_patterns(confidence DESC);

-- Enable Row Level Security
ALTER TABLE public.skill_patterns ENABLE ROW LEVEL SECURITY;

-- Service role only policy (consistent with other tables)
CREATE POLICY "Service role only for skill_patterns"
ON public.skill_patterns
AS RESTRICTIVE
FOR ALL
USING (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text)
WITH CHECK (((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text) = 'service_role'::text);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_skill_patterns_updated_at
BEFORE UPDATE ON public.skill_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();