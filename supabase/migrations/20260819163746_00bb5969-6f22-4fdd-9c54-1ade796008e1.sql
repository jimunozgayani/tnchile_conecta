-- Move contact banking details into a dedicated, strictly restricted table
CREATE TABLE public.contactos_datos_bancarios (
  contacto_id uuid PRIMARY KEY REFERENCES public.contactos(id) ON DELETE CASCADE,
  banco text,
  tipo_cuenta text,
  numero_cuenta text,
  email_banco text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contactos_datos_bancarios TO authenticated;
GRANT ALL ON public.contactos_datos_bancarios TO service_role;

ALTER TABLE public.contactos_datos_bancarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solo comercial y admin gestionan datos bancarios"
  ON public.contactos_datos_bancarios FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider_cuenta'::app_role)
    OR public.has_role(auth.uid(), 'comercial'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'lider_cuenta'::app_role)
    OR public.has_role(auth.uid(), 'comercial'::app_role)
  );

CREATE TRIGGER contactos_datos_bancarios_set_updated_at
  BEFORE UPDATE ON public.contactos_datos_bancarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Migrate any existing values (currently none) and remove the columns from the
-- tables that operations roles can read.
INSERT INTO public.contactos_datos_bancarios (contacto_id, banco, tipo_cuenta, numero_cuenta, email_banco)
SELECT id, banco, tipo_cuenta, numero_cuenta, email_banco
FROM public.contactos
WHERE banco IS NOT NULL OR tipo_cuenta IS NOT NULL OR numero_cuenta IS NOT NULL OR email_banco IS NOT NULL
ON CONFLICT (contacto_id) DO NOTHING;

DROP VIEW IF EXISTS public.contactos_operaciones;
DROP VIEW IF EXISTS public.pagos_proveedor_operaciones;

ALTER TABLE public.contactos
  DROP COLUMN banco,
  DROP COLUMN tipo_cuenta,
  DROP COLUMN numero_cuenta,
  DROP COLUMN email_banco;

ALTER TABLE public.pagos_proveedor
  DROP COLUMN banco,
  DROP COLUMN tipo_cuenta,
  DROP COLUMN numero_cuenta,
  DROP COLUMN email_banco;

CREATE VIEW public.contactos_operaciones WITH (security_invoker = on) AS
  SELECT id, nombre, empresa, rut, telefono, email, region, origen_contacto,
         temperatura, etapa_comercial, responsable_id, notas, created_at,
         updated_at, deleted_at, tipos, profile_id, driver_id, user_id
  FROM public.contactos;

CREATE VIEW public.pagos_proveedor_operaciones WITH (security_invoker = on) AS
  SELECT id, operacion_id, asignacion_id, tipo_pago, numero_cuota, monto_clp,
         fecha_vencimiento, proveedor_nombre, proveedor_rut, estado,
         autorizado_por, autorizado_at, comprobante_path, comprobante_subido_at,
         comprobante_subido_por, notas, created_at, updated_at, deleted_at
  FROM public.pagos_proveedor;

GRANT SELECT ON public.contactos_operaciones TO authenticated;
GRANT SELECT ON public.pagos_proveedor_operaciones TO authenticated;