-- Create table for storing candidate profiles history
CREATE TABLE public.candidate_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_name TEXT NOT NULL DEFAULT 'Default',
  candidate_id TEXT NOT NULL,
  name TEXT NOT NULL,
  current_title TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  summary TEXT,
  skills JSONB DEFAULT '[]'::jsonb,
  work_history JSONB DEFAULT '[]'::jsonb,
  education JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all operations (will be restricted per user later)
CREATE POLICY "Allow all operations on candidate_profiles"
ON public.candidate_profiles
FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_candidate_profiles_updated_at
BEFORE UPDATE ON public.candidate_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_candidate_profiles_profile_name ON public.candidate_profiles(profile_name);
CREATE INDEX idx_candidate_profiles_created_at ON public.candidate_profiles(created_at DESC);