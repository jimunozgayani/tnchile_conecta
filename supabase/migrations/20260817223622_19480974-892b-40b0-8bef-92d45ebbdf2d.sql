-- Views back to invoker semantics (no security-definer views)
CREATE OR REPLACE VIEW public.contactos_operaciones
WITH (security_invoker = true) AS
SELECT id, nombre, empresa, rut, telefono, email, region, origen_contacto,
       temperatura, etapa_comercial, responsable_id, notas, created_at,
       updated_at, deleted_at, tipos, profile_id, driver_id, user_id
FROM public.contactos;

CREATE OR REPLACE VIEW public.pagos_proveedor_operaciones
WITH (security_invoker = true) AS
SELECT id, operacion_id, asignacion_id, tipo_pago, numero_cuota, monto_clp,
       fecha_vencimiento, proveedor_nombre, proveedor_rut, estado,
       autorizado_por, autorizado_at, comprobante_path, comprobante_subido_at,
       comprobante_subido_por, notas, created_at, updated_at, deleted_at
FROM public.pagos_proveedor;

REVOKE ALL ON public.contactos_operaciones FROM anon;
REVOKE ALL ON public.pagos_proveedor_operaciones FROM anon;
GRANT SELECT ON public.contactos_operaciones TO authenticated;
GRANT SELECT ON public.pagos_proveedor_operaciones TO authenticated;
GRANT ALL ON public.contactos_operaciones TO service_role;
GRANT ALL ON public.pagos_proveedor_operaciones TO service_role;

-- Row access for operations staff, limited to non-banking columns only
CREATE POLICY "operador lee contactos" ON public.contactos
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'jefe_operaciones'));

CREATE POLICY "operador lee pagos" ON public.pagos_proveedor
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'operador') OR public.has_role(auth.uid(), 'jefe_operaciones'));

-- Hard guarantee: banking columns are not readable by any client role
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.contactos FROM authenticated, anon;
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.pagos_proveedor FROM authenticated, anon;
REVOKE UPDATE (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.contactos FROM authenticated, anon;
REVOKE UPDATE (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.pagos_proveedor FROM authenticated, anon;