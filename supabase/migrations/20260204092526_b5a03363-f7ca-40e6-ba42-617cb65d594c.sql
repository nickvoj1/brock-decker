-- Add policy to allow inserting feedback logs from frontend
CREATE POLICY "Allow insert feedback_log"
ON public.feedback_log
FOR INSERT
WITH CHECK (true);

-- Add policy to allow reading feedback logs
CREATE POLICY "Allow read feedback_log"
ON public.feedback_log
FOR SELECT
USING (true);

-- Also add similar policies for signals table updates
CREATE POLICY "Allow update signals"
ON public.signals
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow read signals"
ON public.signals
FOR SELECT
USING (true);