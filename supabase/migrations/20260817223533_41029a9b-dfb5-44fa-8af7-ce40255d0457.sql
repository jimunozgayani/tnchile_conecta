-- 1. Remove direct table reads for the operador role
DROP POLICY IF EXISTS "operador lee contactos" ON public.contactos;
DROP POLICY IF EXISTS "operador lee pagos" ON public.pagos_proveedor;

-- 2. Views enforce their own role check and exclude banking columns
CREATE OR REPLACE VIEW public.contactos_operaciones
WITH (security_invoker = false) AS
SELECT id, nombre, empresa, rut, telefono, email, region, origen_contacto,
       temperatura, etapa_comercial, responsable_id, notas, created_at,
       updated_at, deleted_at, tipos, profile_id, driver_id, user_id
FROM public.contactos
WHERE public.has_role(auth.uid(), 'admin')
   OR public.has_role(auth.uid(), 'lider_cuenta')
   OR public.has_role(auth.uid(), 'jefe_operaciones')
   OR public.has_role(auth.uid(), 'operador')
   OR public.has_role(auth.uid(), 'comercial');

CREATE OR REPLACE VIEW public.pagos_proveedor_operaciones
WITH (security_invoker = false) AS
SELECT id, operacion_id, asignacion_id, tipo_pago, numero_cuota, monto_clp,
       fecha_vencimiento, proveedor_nombre, proveedor_rut, estado,
       autorizado_por, autorizado_at, comprobante_path, comprobante_subido_at,
       comprobante_subido_por, notas, created_at, updated_at, deleted_at
FROM public.pagos_proveedor
WHERE public.has_role(auth.uid(), 'admin')
   OR public.has_role(auth.uid(), 'lider_cuenta')
   OR public.has_role(auth.uid(), 'jefe_operaciones')
   OR public.has_role(auth.uid(), 'operador')
   OR public.has_role(auth.uid(), 'comercial');

REVOKE ALL ON public.contactos_operaciones FROM anon;
REVOKE ALL ON public.pagos_proveedor_operaciones FROM anon;
GRANT SELECT ON public.contactos_operaciones TO authenticated;
GRANT SELECT ON public.pagos_proveedor_operaciones TO authenticated;
GRANT ALL ON public.contactos_operaciones TO service_role;
GRANT ALL ON public.pagos_proveedor_operaciones TO service_role;