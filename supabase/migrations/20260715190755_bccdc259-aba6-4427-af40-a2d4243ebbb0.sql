
ALTER TABLE public.asignaciones
  ADD COLUMN IF NOT EXISTS cotizacion_id UUID REFERENCES public.cotizaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado_viaje TEXT NOT NULL DEFAULT 'por_iniciar'
    CHECK (estado_viaje IN ('por_iniciar','cargando','en_ruta','descargando','entregado'));

CREATE INDEX IF NOT EXISTS asignaciones_chofer_idx ON public.asignaciones(chofer_id);

-- Chofer can see and update trip status on their own assignments (only if approved)
CREATE POLICY "chofer aprobado ve sus asignaciones" ON public.asignaciones
  FOR SELECT TO authenticated
  USING (
    auth.uid() = chofer_id AND EXISTS (
      SELECT 1 FROM public.chofer_perfiles cp
      WHERE cp.user_id = auth.uid() AND cp.estado_validacion = 'aprobado'
    )
  );

CREATE POLICY "chofer aprobado actualiza estado viaje" ON public.asignaciones
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = chofer_id AND EXISTS (
      SELECT 1 FROM public.chofer_perfiles cp
      WHERE cp.user_id = auth.uid() AND cp.estado_validacion = 'aprobado'
    )
  )
  WITH CHECK (auth.uid() = chofer_id);

-- Chofer can read the linked quote for their assignments
CREATE POLICY "chofer ve cotizaciones asignadas" ON public.cotizaciones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.asignaciones a
      JOIN public.chofer_perfiles cp ON cp.user_id = auth.uid()
      WHERE a.cotizacion_id = cotizaciones.id
        AND a.chofer_id = auth.uid()
        AND cp.estado_validacion = 'aprobado'
    )
  );
