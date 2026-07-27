DROP POLICY IF EXISTS "anon sube archivos carga publica" ON storage.objects;
CREATE POLICY "anon sube archivos carga publica"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'carga-publica');

DROP POLICY IF EXISTS "staff lee archivos carga publica" ON storage.objects;
CREATE POLICY "staff lee archivos carga publica"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'carga-publica'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operador'::app_role))
  );