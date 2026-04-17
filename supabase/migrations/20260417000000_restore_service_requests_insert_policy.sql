-- Restore INSERT policy for service_requests
-- The previous policy was removed without replacement, breaking the contact form.
-- Anyone (authenticated or anonymous) can submit a service request.
CREATE POLICY "Anyone can insert service requests"
ON public.service_requests
FOR INSERT
WITH CHECK (true);
