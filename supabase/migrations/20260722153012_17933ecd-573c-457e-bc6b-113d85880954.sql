
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS email text;

CREATE TABLE IF NOT EXISTS public.driver_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','usada','expirada','revocada')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_driver_invitations_driver_id ON public.driver_invitations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_invitations_token ON public.driver_invitations(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_invitations TO authenticated;
GRANT ALL ON public.driver_invitations TO service_role;

ALTER TABLE public.driver_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedor ve invitaciones de sus propios choferes"
  ON public.driver_invitations FOR SELECT TO authenticated
  USING (
    driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "proveedor crea invitaciones de sus propios choferes"
  ON public.driver_invitations FOR INSERT TO authenticated
  WITH CHECK (
    driver_id IN (SELECT d.id FROM public.drivers d WHERE d.user_id = auth.uid())
    OR public.has_role(auth.uid(),'admin'::app_role)
  );

CREATE POLICY "admin actualiza invitaciones de choferes"
  ON public.driver_invitations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "admin elimina invitaciones de choferes"
  ON public.driver_invitations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));
