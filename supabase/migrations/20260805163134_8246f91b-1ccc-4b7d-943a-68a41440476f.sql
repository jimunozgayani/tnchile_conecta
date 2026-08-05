CREATE POLICY "admin crea cotizaciones" ON public.cotizaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "comercial ve cotizaciones" ON public.cotizaciones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "comercial crea cotizaciones" ON public.cotizaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "comercial actualiza cotizaciones" ON public.cotizaciones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'comercial'))
  WITH CHECK (public.has_role(auth.uid(), 'comercial'));
CREATE POLICY "jefe_operaciones ve cotizaciones" ON public.cotizaciones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'jefe_operaciones'));