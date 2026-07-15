DROP POLICY IF EXISTS "chofer aprobado ve sus asignaciones" ON public.asignaciones;
CREATE POLICY "chofer aprobado ve sus asignaciones" ON public.asignaciones
  FOR SELECT TO authenticated
  USING (chofer_id IN (SELECT public.chofer_driver_ids(auth.uid())));

DROP POLICY IF EXISTS "chofer aprobado actualiza estado viaje" ON public.asignaciones;
CREATE POLICY "chofer aprobado actualiza estado viaje" ON public.asignaciones
  FOR UPDATE TO authenticated
  USING (chofer_id IN (SELECT public.chofer_driver_ids(auth.uid())))
  WITH CHECK (chofer_id IN (SELECT public.chofer_driver_ids(auth.uid())));

GRANT EXECUTE ON FUNCTION public.chofer_driver_ids(uuid) TO authenticated;