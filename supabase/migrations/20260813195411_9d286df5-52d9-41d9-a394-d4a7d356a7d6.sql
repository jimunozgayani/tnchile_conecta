DROP POLICY IF EXISTS "comercial ve cotizaciones" ON public.cotizaciones;
CREATE POLICY "comercial ve cotizaciones asignadas" ON public.cotizaciones
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'comercial') AND asignado_a = auth.uid());

DROP POLICY IF EXISTS "comercial actualiza cotizaciones" ON public.cotizaciones;
CREATE POLICY "comercial actualiza cotizaciones asignadas" ON public.cotizaciones
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'comercial') AND asignado_a = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'comercial') AND asignado_a = auth.uid());