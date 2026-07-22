
-- Fix 1: allow 'asignada' state on cotizaciones
ALTER TABLE public.cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado IN ('pendiente','en_revision','cotizada','aceptada','rechazada','cancelada','asignada'));

-- Fix 2: eventos_viaje INSERT policy must map auth.uid() -> drivers.id via chofer_driver_ids
DROP POLICY IF EXISTS "Chofer inserta sus eventos" ON public.eventos_viaje;
CREATE POLICY "Chofer inserta sus eventos"
  ON public.eventos_viaje FOR INSERT TO authenticated
  WITH CHECK (
    chofer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.asignaciones a
      WHERE a.id = asignacion_id
        AND a.chofer_id IN (SELECT public.chofer_driver_ids(auth.uid()))
    )
  );

-- Also let admins insert events (e.g. from ops tooling) so timeline works
DROP POLICY IF EXISTS "Admin inserta eventos" ON public.eventos_viaje;
CREATE POLICY "Admin inserta eventos"
  ON public.eventos_viaje FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
