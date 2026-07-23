
-- 1. drivers: origen_registro + creado_por
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS origen_registro text NOT NULL DEFAULT 'proveedor'
    CHECK (origen_registro IN ('proveedor', 'operaciones')),
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id);

-- Admin full management policy for drivers (none existed for INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "admin gestiona choferes" ON public.drivers;
CREATE POLICY "admin gestiona choferes" ON public.drivers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. disponibilidad_chofer: fuente column
ALTER TABLE public.disponibilidad_chofer
  ADD COLUMN IF NOT EXISTS fuente text NOT NULL DEFAULT 'proveedor'
    CHECK (fuente IN ('chofer', 'proveedor', 'operaciones'));

-- 3. Partial unique index for single-day rows
CREATE UNIQUE INDEX IF NOT EXISTS disponibilidad_chofer_driver_day_uidx
  ON public.disponibilidad_chofer (driver_id, fecha_desde)
  WHERE fecha_desde = fecha_hasta;
