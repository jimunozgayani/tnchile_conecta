ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.metas ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS metas_user_id_idx ON public.metas (user_id);

DROP POLICY IF EXISTS "staff lee sus propias metas" ON public.metas;
CREATE POLICY "staff lee metas propias y de equipo"
ON public.metas FOR SELECT TO authenticated
USING (
  (user_id IS NOT NULL AND user_id = auth.uid())
  OR (
    user_id IS NULL AND (
      (rol = 'comercial' AND public.has_role(auth.uid(), 'comercial'::app_role))
      OR (rol = 'operador' AND public.has_role(auth.uid(), 'operador'::app_role))
    )
  )
);

-- Avatares de perfil: cada usuario administra su propia carpeta
CREATE POLICY "avatares: lectura propia"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatares-perfil'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "avatares: subida propia"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatares-perfil'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatares: actualiza propia"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatares-perfil'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatares-perfil'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatares: borra propia"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatares-perfil'
  AND (storage.foldername(name))[1] = auth.uid()::text
);