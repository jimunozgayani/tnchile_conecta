CREATE POLICY "Admin inserta disp de cualquier chofer"
  ON public.disponibilidad_chofer FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin actualiza disp de cualquier chofer"
  ON public.disponibilidad_chofer FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Admin elimina disp de cualquier chofer"
  ON public.disponibilidad_chofer FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));