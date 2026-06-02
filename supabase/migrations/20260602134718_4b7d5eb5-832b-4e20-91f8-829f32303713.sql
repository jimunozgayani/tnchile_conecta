
CREATE POLICY "users view own invitation"
ON public.supplier_invitations
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR lower(email) = lower((auth.jwt() ->> 'email')));
