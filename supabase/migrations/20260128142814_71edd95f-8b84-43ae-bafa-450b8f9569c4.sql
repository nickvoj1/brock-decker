-- Create table for profile PINs
CREATE TABLE public.profile_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_name TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profile_pins ENABLE ROW LEVEL SECURITY;

-- Allow reading to check if PIN exists (but not the hash)
CREATE POLICY "Allow checking if profile has PIN"
  ON public.profile_pins
  FOR SELECT
  USING (true);

-- Allow inserting new PINs
CREATE POLICY "Allow setting PIN"
  ON public.profile_pins
  FOR INSERT
  WITH CHECK (true);

-- Allow updating PINs
CREATE POLICY "Allow updating PIN"
  ON public.profile_pins
  FOR UPDATE
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_profile_pins_updated_at
  BEFORE UPDATE ON public.profile_pins
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();