-- Add tier and score columns to signals table for new taxonomy
ALTER TABLE public.signals 
ADD COLUMN IF NOT EXISTS tier text,
ADD COLUMN IF NOT EXISTS score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS contacts_url text;

-- Update existing signals with tier/score based on signal_type
UPDATE public.signals
SET 
  tier = CASE 
    WHEN signal_type IN ('fund_close', 'deal', 'senior_hire') THEN 'tier_1'
    WHEN signal_type IN ('new_fund', 'expansion') THEN 'tier_2'
    WHEN signal_type IN ('exit') THEN 'tier_3'
    ELSE 'tier_2'
  END,
  score = CASE
    WHEN signal_type = 'fund_close' AND amount >= 500 THEN 95
    WHEN signal_type = 'fund_close' AND amount >= 100 THEN 85
    WHEN signal_type = 'fund_close' THEN 75
    WHEN signal_type = 'deal' AND amount >= 100 THEN 80
    WHEN signal_type = 'deal' THEN 70
    WHEN signal_type = 'senior_hire' THEN 75
    WHEN signal_type = 'new_fund' THEN 65
    WHEN signal_type = 'expansion' THEN 60
    WHEN signal_type = 'exit' THEN 50
    ELSE 40
  END
WHERE tier IS NULL;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_signals_tier ON public.signals(tier);
CREATE INDEX IF NOT EXISTS idx_signals_score ON public.signals(score);
CREATE INDEX IF NOT EXISTS idx_signals_region_tier ON public.signals(region, tier);