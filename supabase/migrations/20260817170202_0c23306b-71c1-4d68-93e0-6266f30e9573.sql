CREATE POLICY "staff interno lee documentos-operacion"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-operacion' AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.has_role(auth.uid(), 'lider_cuenta'::app_role) OR
      public.has_role(auth.uid(), 'jefe_operaciones'::app_role) OR
      public.has_role(auth.uid(), 'operador'::app_role) OR
      public.has_role(auth.uid(), 'comercial'::app_role)
    )
  );

CREATE POLICY "admin y lider suben documentos-operacion"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-operacion' AND (
      public.has_role(auth.uid(), 'admin'::app_role) OR
      public.has_role(auth.uid(), 'lider_cuenta'::app_role)
    )
  );