CREATE TABLE IF NOT EXISTS public.metas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rol text NOT NULL,
  periodo text NOT NULL,
  descripcion text NOT NULL,
  valor_objetivo numeric,
  valor_actual numeric DEFAULT 0,
  unidad text,
  creado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas TO authenticated;
GRANT ALL ON public.metas TO service_role;

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lider_cuenta gestiona metas comercial"
  ON public.metas FOR ALL TO authenticated
  USING (rol = 'comercial' AND public.has_role(auth.uid(), 'lider_cuenta'::app_role))
  WITH CHECK (rol = 'comercial' AND public.has_role(auth.uid(), 'lider_cuenta'::app_role));

CREATE POLICY "jefe_operaciones gestiona metas operaciones"
  ON public.metas FOR ALL TO authenticated
  USING (rol = 'operador' AND public.has_role(auth.uid(), 'jefe_operaciones'::app_role))
  WITH CHECK (rol = 'operador' AND public.has_role(auth.uid(), 'jefe_operaciones'::app_role));

CREATE POLICY "admin gestiona todas las metas"
  ON public.metas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "staff lee sus propias metas"
  ON public.metas FOR SELECT TO authenticated
  USING (
    (rol = 'comercial' AND public.has_role(auth.uid(), 'comercial'::app_role))
    OR (rol = 'operador' AND public.has_role(auth.uid(), 'operador'::app_role))
  );

CREATE TRIGGER metas_set_updated_at BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS metas_rol_periodo_idx ON public.metas (rol, periodo);

-- Storage: documentos privados por usuario ([user_id]/archivo)
CREATE POLICY "admin sube documentos privados"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-privados' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin elimina documentos privados"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-privados' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "usuario lee sus documentos privados"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos-privados'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin'::app_role))
  );