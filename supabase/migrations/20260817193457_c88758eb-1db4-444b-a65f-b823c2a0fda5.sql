DROP POLICY IF EXISTS "cot fotos: cliente ve sus fotos, admin ve todas" ON storage.objects;
CREATE POLICY "cot fotos: cliente ve sus fotos, staff interno ve todas"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cotizacion-fotos'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider_cuenta'::app_role)
    OR public.has_role(auth.uid(), 'jefe_operaciones'::app_role)
    OR public.has_role(auth.uid(), 'operador'::app_role)
    OR public.has_role(auth.uid(), 'comercial'::app_role)
  )
);