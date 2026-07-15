
CREATE POLICY "admin escribe asignaciones" ON public.asignaciones FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin actualiza asignaciones" ON public.asignaciones FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin borra asignaciones" ON public.asignaciones FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
