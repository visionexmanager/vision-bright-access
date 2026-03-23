-- Allow admins to view all service requests
CREATE POLICY "Admins can view all service requests"
ON public.service_requests FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));