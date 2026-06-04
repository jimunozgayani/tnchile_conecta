
CREATE TABLE public.asignaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  camion_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  chofer_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  activa BOOLEAN NOT NULL DEFAULT true,
  fecha_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_hasta DATE,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asignaciones TO authenticated;
GRANT ALL ON public.asignaciones TO service_role;

ALTER TABLE public.asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own asignaciones select" ON public.asignaciones FOR SELECT TO authenticated
  USING (auth.uid() = proveedor_id);
CREATE POLICY "own asignaciones insert" ON public.asignaciones FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proveedor_id);
CREATE POLICY "own asignaciones update" ON public.asignaciones FOR UPDATE TO authenticated
  USING (auth.uid() = proveedor_id) WITH CHECK (auth.uid() = proveedor_id);
CREATE POLICY "own asignaciones delete" ON public.asignaciones FOR DELETE TO authenticated
  USING (auth.uid() = proveedor_id);
CREATE POLICY "admin reads asignaciones" ON public.asignaciones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX asignaciones_one_active_per_truck
  ON public.asignaciones (camion_id) WHERE activa = true;

CREATE TRIGGER asignaciones_updated_at BEFORE UPDATE ON public.asignaciones
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();

ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS estado_operativo TEXT NOT NULL DEFAULT 'disponible'
  CHECK (estado_operativo IN ('disponible','en_ruta','mantenimiento','inactivo'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.asignaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trucks;
ALTER TABLE public.asignaciones REPLICA IDENTITY FULL;
ALTER TABLE public.trucks REPLICA IDENTITY FULL;
