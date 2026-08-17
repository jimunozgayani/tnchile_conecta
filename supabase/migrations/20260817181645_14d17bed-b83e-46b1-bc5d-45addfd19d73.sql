-- Reinforce: banking columns must never be readable through the Data API for app roles
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.contactos FROM authenticated;
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.contactos FROM anon;
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.pagos_proveedor FROM authenticated;
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.pagos_proveedor FROM anon;

-- Explicit, self-documenting operational read surface for pagos (no banking fields)
DROP VIEW IF EXISTS public.pagos_proveedor_operaciones;
CREATE VIEW public.pagos_proveedor_operaciones WITH (security_invoker = true) AS
SELECT id, operacion_id, asignacion_id, tipo_pago, numero_cuota, monto_clp,
       fecha_vencimiento, proveedor_nombre, proveedor_rut, estado,
       autorizado_por, autorizado_at, comprobante_path, comprobante_subido_at,
       comprobante_subido_por, notas, created_at, updated_at, deleted_at
FROM public.pagos_proveedor;

REVOKE ALL ON public.pagos_proveedor_operaciones FROM anon;
GRANT SELECT ON public.pagos_proveedor_operaciones TO authenticated;
GRANT ALL ON public.pagos_proveedor_operaciones TO service_role;

-- The view on contactos should not be reachable by anonymous visitors either
REVOKE ALL ON public.contactos_operaciones FROM anon;

COMMENT ON POLICY "operador lee contactos" ON public.contactos IS
  'Row access only; banking columns (banco, tipo_cuenta, numero_cuenta, email_banco) are revoked at column level for authenticated/anon. Operators read via public.contactos_operaciones.';
COMMENT ON POLICY "operador lee pagos" ON public.pagos_proveedor IS
  'Row access only; banking columns are revoked at column level for authenticated/anon. Operators read via public.pagos_proveedor_operaciones.';