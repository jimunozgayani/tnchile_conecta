CREATE POLICY "lider_cuenta full access cotizaciones"
  ON public.cotizaciones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'lider_cuenta'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'lider_cuenta'::app_role));

CREATE POLICY "lider_cuenta full access contactos"
  ON public.contactos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'lider_cuenta'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'lider_cuenta'::app_role));

CREATE POLICY "jefe_operaciones full access asignaciones"
  ON public.asignaciones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'jefe_operaciones'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'jefe_operaciones'::app_role));

CREATE POLICY "jefe_operaciones full access disponibilidad"
  ON public.disponibilidad_chofer FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'jefe_operaciones'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'jefe_operaciones'::app_role));

CREATE POLICY "lider_cuenta reads audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'lider_cuenta'::app_role));

CREATE POLICY "jefe_operaciones reads audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'jefe_operaciones'::app_role));