
CREATE TABLE public.tarifas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  region_origen TEXT NOT NULL,
  region_destino TEXT NOT NULL,
  tipo_camion TEXT NOT NULL CHECK (tipo_camion IN ('tracto','rigido','plataforma','furgon')),
  precio_base_clp INTEGER,
  precio_por_km_clp INTEGER,
  incluye_iva BOOLEAN NOT NULL DEFAULT false,
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proveedor_id, region_origen, region_destino, tipo_camion)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas TO authenticated;
GRANT ALL ON public.tarifas TO service_role;

ALTER TABLE public.tarifas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tarifas select" ON public.tarifas FOR SELECT TO authenticated
  USING (auth.uid() = proveedor_id);
CREATE POLICY "own tarifas insert" ON public.tarifas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proveedor_id);
CREATE POLICY "own tarifas update" ON public.tarifas FOR UPDATE TO authenticated
  USING (auth.uid() = proveedor_id) WITH CHECK (auth.uid() = proveedor_id);
CREATE POLICY "own tarifas delete" ON public.tarifas FOR DELETE TO authenticated
  USING (auth.uid() = proveedor_id);
CREATE POLICY "admin reads all tarifas" ON public.tarifas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.tarifas_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tarifas_updated_at BEFORE UPDATE ON public.tarifas
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();

CREATE INDEX tarifas_route_idx ON public.tarifas (region_origen, region_destino, tipo_camion, precio_base_clp);
CREATE INDEX tarifas_proveedor_idx ON public.tarifas (proveedor_id);
