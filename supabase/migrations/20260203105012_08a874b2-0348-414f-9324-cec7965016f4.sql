-- Drop the old region check constraint and add updated one with new regions
ALTER TABLE public.signals DROP CONSTRAINT IF EXISTS signals_region_check;

ALTER TABLE public.signals ADD CONSTRAINT signals_region_check 
CHECK (region IN ('london', 'europe', 'uae', 'usa', 'east_usa', 'west_usa'));

-- Update any existing signals with old region names
UPDATE public.signals SET region = 'europe' WHERE region IN ('uk', 'dach', 'france', 'netherlands');
UPDATE public.signals SET region = 'usa' WHERE region IN ('east_usa', 'west_usa');