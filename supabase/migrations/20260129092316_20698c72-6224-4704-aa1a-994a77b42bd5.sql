-- Create table for pitch templates (per user profile)
CREATE TABLE public.pitch_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_name TEXT NOT NULL,
  name TEXT NOT NULL,
  subject_template TEXT,
  body_template TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for generated pitches history
CREATE TABLE public.generated_pitches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_name TEXT NOT NULL,
  template_id UUID REFERENCES public.pitch_templates(id) ON DELETE SET NULL,
  candidate_name TEXT NOT NULL,
  candidate_title TEXT,
  subject TEXT,
  body TEXT NOT NULL,
  industries TEXT[] DEFAULT '{}',
  locations TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pitch_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_pitches ENABLE ROW LEVEL SECURITY;

-- RLS policies for pitch_templates
CREATE POLICY "Allow all operations on pitch_templates"
ON public.pitch_templates FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for generated_pitches
CREATE POLICY "Allow all operations on generated_pitches"
ON public.generated_pitches FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at on pitch_templates
CREATE TRIGGER update_pitch_templates_updated_at
BEFORE UPDATE ON public.pitch_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_pitch_templates_profile ON public.pitch_templates(profile_name);
CREATE INDEX idx_generated_pitches_profile ON public.generated_pitches(profile_name);
CREATE INDEX idx_generated_pitches_created ON public.generated_pitches(created_at DESC);