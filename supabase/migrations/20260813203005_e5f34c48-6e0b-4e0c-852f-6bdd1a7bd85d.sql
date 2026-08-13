-- 1) No anon-callable SECURITY DEFINER functions: routed через server functions instead
REVOKE EXECUTE ON FUNCTION public.crear_solicitud_carga(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.crear_solicitud_carga(jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_email_locked(text) FROM anon;

-- 2) Replace SECURITY DEFINER view with a security_invoker view + explicit RLS for operador
DROP VIEW IF EXISTS public.contactos_operaciones;
CREATE VIEW public.contactos_operaciones WITH (security_invoker = true) AS
SELECT id, nombre, empresa, rut, telefono, email, region, origen_contacto,
       temperatura, etapa_comercial, responsable_id, notas,
       created_at, updated_at, deleted_at, tipos, profile_id, driver_id, user_id
FROM public.contactos;

GRANT SELECT ON public.contactos_operaciones TO authenticated;
GRANT ALL ON public.contactos_operaciones TO service_role;

DROP POLICY IF EXISTS "operador lee contactos" ON public.contactos;
CREATE POLICY "operador lee contactos" ON public.contactos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operador'::app_role));

-- Banking columns become unreadable through the Data API for every app role
REVOKE SELECT ON public.contactos FROM authenticated;
REVOKE SELECT ON public.contactos FROM anon;
GRANT SELECT (id, nombre, empresa, rut, telefono, email, region, origen_contacto,
              temperatura, etapa_comercial, responsable_id, notas,
              created_at, updated_at, deleted_at, tipos, profile_id, driver_id, user_id)
  ON public.contactos TO authenticated;

-- 3) pagos_proveedor: drop operador blanket ALL, no banking column exposure
DROP POLICY IF EXISTS "operador gestiona pagos" ON public.pagos_proveedor;

CREATE POLICY "operador lee pagos" ON public.pagos_proveedor
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operador'::app_role));
CREATE POLICY "operador crea pagos" ON public.pagos_proveedor
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'operador'::app_role));
CREATE POLICY "operador actualiza pagos" ON public.pagos_proveedor
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'operador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'operador'::app_role));

REVOKE SELECT, UPDATE ON public.pagos_proveedor FROM authenticated;
REVOKE SELECT, UPDATE ON public.pagos_proveedor FROM anon;
GRANT SELECT (id, operacion_id, asignacion_id, tipo_pago, numero_cuota, monto_clp,
              fecha_vencimiento, proveedor_nombre, proveedor_rut, estado,
              autorizado_por, autorizado_at, comprobante_path, comprobante_subido_at,
              comprobante_subido_por, notas, created_at, updated_at, deleted_at)
  ON public.pagos_proveedor TO authenticated;
GRANT UPDATE (tipo_pago, numero_cuota, monto_clp, fecha_vencimiento, proveedor_nombre,
              proveedor_rut, estado, autorizado_por, autorizado_at, comprobante_path,
              comprobante_subido_at, comprobante_subido_por, notas, updated_at, deleted_at)
  ON public.pagos_proveedor TO authenticated;
GRANT ALL ON public.pagos_proveedor TO service_role;
GRANT ALL ON public.contactos TO service_role;