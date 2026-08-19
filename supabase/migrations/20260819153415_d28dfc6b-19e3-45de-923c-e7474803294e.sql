ALTER TABLE public.eventos_viaje
  ADD COLUMN IF NOT EXISTS subido_por uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='staff sube fotos de viaje'
  ) THEN
    CREATE POLICY "staff sube fotos de viaje"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'viaje-eventos' AND (
          public.has_role(auth.uid(), 'admin'::app_role) OR
          public.has_role(auth.uid(), 'operador'::app_role) OR
          public.has_role(auth.uid(), 'jefe_operaciones'::app_role)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='staff lee fotos de viaje'
  ) THEN
    CREATE POLICY "staff lee fotos de viaje"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'viaje-eventos' AND (
          public.has_role(auth.uid(), 'admin'::app_role) OR
          public.has_role(auth.uid(), 'operador'::app_role) OR
          public.has_role(auth.uid(), 'jefe_operaciones'::app_role)
        )
      );
  END IF;
END $$;