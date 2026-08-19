ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS comprobantes_pago_proveedor jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP POLICY IF EXISTS "admin y lider suben documentos-operacion" ON storage.objects;
CREATE POLICY "admin lider y jefe operaciones suben documentos-operacion"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos-operacion'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider_cuenta'::app_role)
    OR public.has_role(auth.uid(), 'jefe_operaciones'::app_role)
  )
);