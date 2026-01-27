-- Create table to store Bullhorn OAuth tokens
CREATE TABLE public.bullhorn_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  rest_url TEXT NOT NULL,
  bh_rest_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bullhorn_tokens ENABLE ROW LEVEL SECURITY;

-- Allow all operations (single-tenant app)
CREATE POLICY "Allow all operations on bullhorn_tokens"
  ON public.bullhorn_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_bullhorn_tokens_updated_at
  BEFORE UPDATE ON public.bullhorn_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();