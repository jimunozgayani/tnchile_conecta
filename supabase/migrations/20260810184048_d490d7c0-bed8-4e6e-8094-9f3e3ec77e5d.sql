CREATE TABLE IF NOT EXISTS public.propuestas_proveedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  operador_id uuid NOT NULL REFERENCES auth.users(id),
  proveedor_contacto_id uuid REFERENCES public.contactos(id),
  proveedor_nombre text NOT NULL,
  costo_clp numeric NOT NULL,
  tipo_camion_id uuid REFERENCES public.tipos_camion(id),
  notas text,
  estado text NOT NULL DEFAULT 'propuesta'
    CHECK (estado IN ('propuesta', 'ganadora', 'descartada')),
  creado_at timestamptz NOT NULL DEFAULT now(),
  actualizado_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propuestas_proveedor TO authenticated;
GRANT ALL ON public.propuestas_proveedor TO service_role;

ALTER TABLE public.propuestas_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operador gestiona sus propuestas"
  ON public.propuestas_proveedor FOR ALL TO authenticated
  USING (
    operador_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'jefe_operaciones'::app_role)
  )
  WITH CHECK (
    operador_id = auth.uid() OR
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'jefe_operaciones'::app_role)
  );

CREATE POLICY "comercial ve propuestas"
  ON public.propuestas_proveedor FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'comercial'::app_role) OR
    public.has_role(auth.uid(), 'lider_cuenta'::app_role)
  );

CREATE INDEX IF NOT EXISTS idx_propuestas_proveedor_cotizacion
  ON public.propuestas_proveedor(cotizacion_id);

CREATE TRIGGER propuestas_proveedor_actualizado_at
  BEFORE UPDATE ON public.propuestas_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS exploracion_abierta_at timestamptz,
  ADD COLUMN IF NOT EXISTS exploracion_abierta_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS costo_proveedor_fijado_clp numeric,
  ADD COLUMN IF NOT EXISTS propuesta_ganadora_id uuid REFERENCES public.propuestas_proveedor(id),
  ADD COLUMN IF NOT EXISTS gate2_autorizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate2_autorizado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS gate3_autorizado_at timestamptz,
  ADD COLUMN IF NOT EXISTS gate3_autorizado_por uuid REFERENCES auth.users(id);

ALTER TABLE public.cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_estado_check
  CHECK (estado = ANY (ARRAY[
    'nueva','cotizada','en_revision','aceptada','lista_para_operar',
    'confirmada','en_operacion','finalizada','cobro_pendiente','cerrada','rechazada',
    'en_exploracion','costo_fijado','pendiente_gate2','pendiente_gate3'
  ]));