CREATE TABLE public.documentos_operacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id uuid REFERENCES public.operaciones(id) ON DELETE CASCADE,
  tipo text CHECK (tipo IN ('oc_proveedor', 'ov_cliente')),
  folio text UNIQUE NOT NULL,
  pdf_storage_path text,
  enviado_at timestamptz,
  confirmado_at timestamptz,
  confirmado_ip text,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT ON public.documentos_operacion TO authenticated;
GRANT ALL ON public.documentos_operacion TO service_role;

ALTER TABLE public.documentos_operacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff interno ve documentos"
  ON public.documentos_operacion FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'lider_cuenta'::app_role) OR
    public.has_role(auth.uid(), 'jefe_operaciones'::app_role) OR
    public.has_role(auth.uid(), 'operador'::app_role) OR
    public.has_role(auth.uid(), 'comercial'::app_role)
  );

CREATE POLICY "sistema crea documentos"
  ON public.documentos_operacion FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'lider_cuenta'::app_role)
  );

CREATE SEQUENCE IF NOT EXISTS public.seq_folio_oc START 1;
CREATE SEQUENCE IF NOT EXISTS public.seq_folio_ov START 1;

CREATE OR REPLACE FUNCTION public.generar_folio(p_tipo text)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_tipo = 'oc' THEN
    RETURN 'OC-' || to_char(now(),'YYYY') ||
           lpad(nextval('public.seq_folio_oc')::text, 5, '0');
  ELSE
    RETURN 'OV-' || to_char(now(),'YYYY') ||
           lpad(nextval('public.seq_folio_ov')::text, 5, '0');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.generar_folio(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_folio(text) TO authenticated, service_role;
GRANT USAGE ON SEQUENCE public.seq_folio_oc, public.seq_folio_ov TO authenticated, service_role;

CREATE INDEX idx_documentos_operacion_operacion ON public.documentos_operacion(operacion_id);