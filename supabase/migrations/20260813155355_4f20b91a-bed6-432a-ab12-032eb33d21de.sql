DROP POLICY IF EXISTS "operador lee contactos" ON public.contactos;

CREATE OR REPLACE VIEW public.contactos_operaciones
WITH (security_invoker = false) AS
SELECT id, nombre, empresa, rut, telefono, email, region,
       origen_contacto, temperatura, etapa_comercial, responsable_id,
       notas, tipos, profile_id, driver_id, user_id,
       created_at, updated_at, deleted_at
FROM public.contactos
WHERE public.has_role(auth.uid(), 'operador'::app_role)
   OR public.has_role(auth.uid(), 'admin'::app_role)
   OR public.has_role(auth.uid(), 'lider_cuenta'::app_role)
   OR public.has_role(auth.uid(), 'comercial'::app_role);

REVOKE ALL ON public.contactos_operaciones FROM anon;
GRANT SELECT ON public.contactos_operaciones TO authenticated;
GRANT ALL ON public.contactos_operaciones TO service_role;