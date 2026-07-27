ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operador';

CREATE POLICY "admins see all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));