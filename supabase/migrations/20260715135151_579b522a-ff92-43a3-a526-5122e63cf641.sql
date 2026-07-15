
CREATE POLICY "Suppliers view own truck availability" ON public.disponibilidad_camion
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trucks t WHERE t.id = disponibilidad_camion.camion_id AND t.user_id = auth.uid()));

CREATE POLICY "Suppliers insert own truck availability" ON public.disponibilidad_camion
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.trucks t WHERE t.id = disponibilidad_camion.camion_id AND t.user_id = auth.uid() AND NOT is_suspended(auth.uid())));

CREATE POLICY "Suppliers update own truck availability" ON public.disponibilidad_camion
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trucks t WHERE t.id = disponibilidad_camion.camion_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trucks t WHERE t.id = disponibilidad_camion.camion_id AND t.user_id = auth.uid() AND NOT is_suspended(auth.uid())));

CREATE POLICY "Suppliers delete own truck availability" ON public.disponibilidad_camion
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trucks t WHERE t.id = disponibilidad_camion.camion_id AND t.user_id = auth.uid() AND NOT is_suspended(auth.uid())));
