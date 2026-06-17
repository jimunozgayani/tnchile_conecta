-- 1) Table
CREATE TABLE public.polizas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_poliza TEXT,
  aseguradora TEXT,
  tipo_cobertura TEXT,
  monto NUMERIC(14,2),
  fecha_inicio DATE,
  fecha_vencimiento DATE,
  archivo_url TEXT,
  activa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX polizas_proveedor_idx ON public.polizas(proveedor_id) WHERE deleted_at IS NULL;

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polizas TO authenticated;
GRANT ALL ON public.polizas TO service_role;

-- 3) RLS
ALTER TABLE public.polizas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own polizas select" ON public.polizas FOR SELECT TO authenticated
  USING (auth.uid() = proveedor_id);
CREATE POLICY "admin reads all polizas" ON public.polizas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "own polizas insert" ON public.polizas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own polizas update" ON public.polizas FOR UPDATE TO authenticated
  USING (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()))
  WITH CHECK (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own polizas delete" ON public.polizas FOR DELETE TO authenticated
  USING (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()));

-- 4) updated_at trigger
CREATE TRIGGER polizas_set_updated_at
  BEFORE UPDATE ON public.polizas
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();

-- 5) Migrate existing profiles.poliza_seguro_* data
INSERT INTO public.polizas (proveedor_id, archivo_url, fecha_vencimiento, activa)
SELECT id, poliza_seguro_url, poliza_seguro_vencimiento, true
FROM public.profiles
WHERE deleted_at IS NULL
  AND (poliza_seguro_url IS NOT NULL OR poliza_seguro_vencimiento IS NOT NULL);