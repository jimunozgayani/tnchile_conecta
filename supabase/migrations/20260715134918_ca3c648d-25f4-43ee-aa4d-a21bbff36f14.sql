
-- Allow secondary providers (trucks without a user account)
ALTER TABLE public.trucks ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.trucks ADD COLUMN IF NOT EXISTS proveedor_secundario_nombre text;

-- Admin policies to manage secondary-provider trucks (user_id IS NULL)
DROP POLICY IF EXISTS "admin manages secondary trucks insert" ON public.trucks;
CREATE POLICY "admin manages secondary trucks insert" ON public.trucks
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND user_id IS NULL);

DROP POLICY IF EXISTS "admin manages secondary trucks update" ON public.trucks;
CREATE POLICY "admin manages secondary trucks update" ON public.trucks
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "admin manages secondary trucks delete" ON public.trucks;
CREATE POLICY "admin manages secondary trucks delete" ON public.trucks
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
