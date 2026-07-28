-- 1. Remove unrestricted anonymous INSERT paths; the public form uses the
-- SECURITY DEFINER function public.crear_solicitud_carga, which validates input.
DROP POLICY IF EXISTS "anon puede insertar contacto desde formulario" ON public.contactos;
DROP POLICY IF EXISTS "anon puede insertar cotizacion desde formulario" ON public.cotizaciones;

REVOKE INSERT ON public.contactos FROM anon;
REVOKE INSERT ON public.cotizaciones FROM anon;

-- Keep the public form working through the validated RPC only.
GRANT EXECUTE ON FUNCTION public.crear_solicitud_carga(jsonb) TO anon, authenticated;

-- 2. Scope operator write access to company-managed trucks only (user_id IS NULL),
-- so operators cannot modify or delete supplier-owned trucks.
DROP POLICY IF EXISTS "operador actualiza camiones secundarios" ON public.trucks;
CREATE POLICY "operador actualiza camiones secundarios"
ON public.trucks FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'operador'::app_role) AND user_id IS NULL)
WITH CHECK (has_role(auth.uid(), 'operador'::app_role) AND user_id IS NULL);

DROP POLICY IF EXISTS "operador borra camiones secundarios" ON public.trucks;
CREATE POLICY "operador borra camiones secundarios"
ON public.trucks FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'operador'::app_role) AND user_id IS NULL);