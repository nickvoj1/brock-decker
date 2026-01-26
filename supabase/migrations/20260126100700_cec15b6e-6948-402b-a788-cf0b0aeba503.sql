-- Create table to track used contacts and prevent reuse within 2 weeks
CREATE TABLE public.used_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.used_contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations (public access since no auth)
CREATE POLICY "Allow all operations on used_contacts" 
ON public.used_contacts 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for faster email lookups
CREATE INDEX idx_used_contacts_email ON public.used_contacts(email);

-- Create index for faster date-based queries
CREATE INDEX idx_used_contacts_added_at ON public.used_contacts(added_at);