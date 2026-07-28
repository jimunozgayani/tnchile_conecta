-- 3. enum value first (must not be referenced in same tx -> policies use role::text)
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'comercial';

-- 1. extend contactos
ALTER TABLE public.contactos
  ADD COLUMN IF NOT EXISTS tipos text[] NOT NULL DEFAULT ARRAY['cliente'],
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS tipo_cuenta text CHECK (tipo_cuenta IN ('cuenta_corriente','cuenta_vista','cuenta_rut','cuenta_ahorro','otro')),
  ADD COLUMN IF NOT EXISTS numero_cuenta text,
  ADD COLUMN IF NOT EXISTS email_banco text;

ALTER TABLE public.contactos DROP CONSTRAINT IF EXISTS contactos_tipos_check;
ALTER TABLE public.contactos
  ADD CONSTRAINT contactos_tipos_check CHECK (tipos <@ ARRAY['cliente','proveedor','chofer']::text[]);

CREATE INDEX IF NOT EXISTS contactos_tipos_idx ON public.contactos USING GIN (tipos);
CREATE INDEX IF NOT EXISTS contactos_profile_id_idx ON public.contactos (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contactos_driver_id_idx ON public.contactos (driver_id) WHERE driver_id IS NOT NULL;

-- 2. sync existing records
INSERT INTO public.contactos (nombre, empresa, rut, telefono, email, region, tipos, profile_id, temperatura, etapa_comercial)
SELECT COALESCE(NULLIF(TRIM(p.nombre_contacto), ''), NULLIF(TRIM(p.razon_social), ''), p.correo, 'Sin nombre'),
       p.razon_social, p.rut_empresa, p.telefono, p.correo, p.region,
       ARRAY['proveedor'], p.id, 'tibio', 'ganado'
FROM public.profiles p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.contactos c WHERE c.profile_id = p.id);

UPDATE public.contactos c
SET tipos = array_append(c.tipos, 'chofer'), driver_id = d.id
FROM public.drivers d
WHERE d.user_id = c.profile_id
  AND d.deleted_at IS NULL
  AND NOT ('chofer' = ANY(c.tipos))
  AND c.driver_id IS NULL;

INSERT INTO public.contactos (nombre, empresa, rut, telefono, email, tipos, driver_id, temperatura, etapa_comercial)
SELECT COALESCE(NULLIF(TRIM(d.nombre_completo), ''), 'Sin nombre'), NULL, d.rut, d.celular, d.email,
       ARRAY['chofer'], d.id, 'tibio', 'ganado'
FROM public.drivers d
WHERE d.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.contactos c WHERE c.driver_id = d.id);

-- 4. operaciones estado
ALTER TABLE public.operaciones DROP CONSTRAINT IF EXISTS operaciones_estado_check;
ALTER TABLE public.operaciones
  ADD CONSTRAINT operaciones_estado_check CHECK (estado IN (
    'nueva','cotizada','aceptada','lista_para_operar','confirmada',
    'en_operacion','finalizada','cobro_pendiente','cerrada'));
ALTER TABLE public.operaciones ALTER COLUMN estado SET DEFAULT 'nueva';

-- 5. supporting columns
ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS fecha_pago_adelanto date,
  ADD COLUMN IF NOT EXISTS monto_adelanto_clp numeric,
  ADD COLUMN IF NOT EXISTS fecha_pago_proveedor date,
  ADD COLUMN IF NOT EXISTS monto_pago_proveedor_clp numeric,
  ADD COLUMN IF NOT EXISTS fecha_cobro_cliente date,
  ADD COLUMN IF NOT EXISTS monto_cobro_cliente_clp numeric,
  ADD COLUMN IF NOT EXISTS pasada_a_operaciones_at timestamptz,
  ADD COLUMN IF NOT EXISTS pasada_a_operaciones_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS finalizada_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalizada_por uuid REFERENCES auth.users(id);

-- 6. RLS (new enum label referenced as text, safe in same transaction)
DROP POLICY IF EXISTS "comercial gestiona contactos" ON public.contactos;
CREATE POLICY "comercial gestiona contactos" ON public.contactos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'));

DROP POLICY IF EXISTS "operador lee contactos" ON public.contactos;
CREATE POLICY "operador lee contactos" ON public.contactos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operador'::app_role));

DROP POLICY IF EXISTS "comercial lee operaciones" ON public.operaciones;
CREATE POLICY "comercial lee operaciones" ON public.operaciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'));

DROP POLICY IF EXISTS "comercial escribe sus estados" ON public.operaciones;
CREATE POLICY "comercial escribe sus estados" ON public.operaciones FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial')
         AND estado IN ('nueva','cotizada','aceptada','lista_para_operar','cobro_pendiente','cerrada'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'));

DROP POLICY IF EXISTS "comercial inserta operaciones" ON public.operaciones;
CREATE POLICY "comercial inserta operaciones" ON public.operaciones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'));

DROP POLICY IF EXISTS "operador lee operaciones" ON public.operaciones;
CREATE POLICY "operador lee operaciones" ON public.operaciones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'operador'::app_role));

DROP POLICY IF EXISTS "operador escribe sus estados" ON public.operaciones;
CREATE POLICY "operador escribe sus estados" ON public.operaciones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'operador'::app_role)
         AND estado IN ('confirmada','en_operacion','finalizada'))
  WITH CHECK (public.has_role(auth.uid(), 'operador'::app_role));

-- 7. pagos_proveedor
CREATE TABLE IF NOT EXISTS public.pagos_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id uuid NOT NULL REFERENCES public.operaciones(id) ON DELETE CASCADE,
  asignacion_id uuid REFERENCES public.asignaciones(id),
  tipo_pago text NOT NULL DEFAULT '100_al_finalizar'
    CHECK (tipo_pago IN ('50_50','100_al_finalizar','100_15_dias','100_30_dias')),
  numero_cuota int NOT NULL DEFAULT 1 CHECK (numero_cuota IN (1,2)),
  monto_clp numeric NOT NULL,
  fecha_vencimiento date,
  proveedor_nombre text,
  proveedor_rut text,
  banco text,
  tipo_cuenta text,
  numero_cuenta text,
  email_banco text,
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','autorizado','transferido','confirmado')),
  autorizado_por uuid REFERENCES auth.users(id),
  autorizado_at timestamptz,
  comprobante_path text,
  comprobante_subido_at timestamptz,
  comprobante_subido_por uuid REFERENCES auth.users(id),
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagos_proveedor TO authenticated;
GRANT ALL ON public.pagos_proveedor TO service_role;

ALTER TABLE public.pagos_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin full access pagos_proveedor" ON public.pagos_proveedor;
CREATE POLICY "admin full access pagos_proveedor" ON public.pagos_proveedor FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "operador gestiona pagos" ON public.pagos_proveedor;
CREATE POLICY "operador gestiona pagos" ON public.pagos_proveedor FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'operador'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'operador'::app_role));

DROP POLICY IF EXISTS "comercial autoriza pagos" ON public.pagos_proveedor;
CREATE POLICY "comercial autoriza pagos" ON public.pagos_proveedor FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'));

DROP POLICY IF EXISTS "comercial lee pagos" ON public.pagos_proveedor;
CREATE POLICY "comercial lee pagos" ON public.pagos_proveedor FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role::text = 'comercial'));

DROP TRIGGER IF EXISTS pagos_proveedor_set_updated_at ON public.pagos_proveedor;
CREATE TRIGGER pagos_proveedor_set_updated_at
  BEFORE UPDATE ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();