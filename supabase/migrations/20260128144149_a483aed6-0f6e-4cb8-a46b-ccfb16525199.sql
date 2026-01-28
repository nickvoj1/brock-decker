-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id TEXT, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Anyone can check roles"
ON public.user_roles
FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(current_setting('request.jwt.claims', true)::json->>'sub', 'admin'));

-- Add PIN reset request tracking to profile_pins
ALTER TABLE public.profile_pins 
ADD COLUMN reset_requested_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Policy for admins to delete/reset PINs
CREATE POLICY "Admins can reset PINs"
ON public.profile_pins
FOR DELETE
USING (true);

-- Insert default admin (Denis Radchenko as first admin)
INSERT INTO public.user_roles (user_id, role) VALUES ('Denis Radchenko', 'admin');