CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE IF NOT EXISTS public.contactos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa text,
  rut text,
  telefono text,
  email text,
  region text,
  origen_contacto text check (origen_contacto in ('whatsapp','instagram','formulario_web','referido','llamada','otro')),
  temperatura text not null default 'tibio' check (temperatura in ('frio','tibio','caliente')),
  etapa_comercial text not null default 'lead' check (etapa_comercial in ('lead','contactado','cotizado','ganado','perdido')),
  responsable_id uuid references auth.users(id),
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contactos TO authenticated;
GRANT ALL ON public.contactos TO service_role;
ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin full access contactos" ON public.contactos;
CREATE POLICY "admin full access contactos" ON public.contactos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS contacto_id uuid REFERENCES public.contactos(id),
  ADD COLUMN IF NOT EXISTS lineas_servicio jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sobreestadia_horas_libres int DEFAULT 4,
  ADD COLUMN IF NOT EXISTS sobreestadia_tarifa_hora_clp numeric,
  ADD COLUMN IF NOT EXISTS sobreestadia_dias_libres int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sobreestadia_tarifa_dia_clp numeric,
  ADD COLUMN IF NOT EXISTS validez_hasta date,
  ADD COLUMN IF NOT EXISTS precio_ofrecido_cliente_clp numeric,
  ADD COLUMN IF NOT EXISTS precio_maximo_proveedor_clp numeric,
  ADD COLUMN IF NOT EXISTS tipo_pago text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cotizaciones_tipo_pago_check') THEN
    ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_tipo_pago_check
      CHECK (tipo_pago IS NULL OR tipo_pago IN ('contado','15_dias','30_dias','50_50'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.operaciones (
  id uuid primary key default gen_random_uuid(),
  numero_operacion serial,
  cotizacion_id uuid references public.cotizaciones(id),
  contacto_id uuid references public.contactos(id),
  tipo_camion_id uuid references public.tipos_camion(id),
  tipo_camion_otro text,
  origen text,
  destino text,
  peso_kg numeric,
  dimensiones text,
  fotos jsonb default '[]'::jsonb,
  requerimientos_especiales text,
  descripcion_exacta text,
  fecha_tipo text not null default 'sin_fecha' check (fecha_tipo in ('exacta','probable','sin_fecha')),
  fecha_carga date,
  fecha_probable_texto text,
  tipo_pago text check (tipo_pago in ('contado','15_dias','30_dias','50_50')),
  precio_ofrecido_cliente_clp numeric,
  precio_maximo_proveedor_clp numeric,
  precio_proveedor_confirmado_clp numeric,
  estado text not null default 'nueva' check (estado in ('nueva','precio_confirmado','iniciada','en_operacion','finalizada','pago_proveedor','cobro_cliente')),
  asignacion_id uuid references public.asignaciones(id),
  notas_internas text,
  fotos_descarga jsonb default '[]'::jsonb,
  foto_guia_url text,
  creado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operaciones TO authenticated;
GRANT ALL ON public.operaciones TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.operaciones_numero_operacion_seq TO authenticated;
GRANT ALL ON SEQUENCE public.operaciones_numero_operacion_seq TO service_role;
ALTER TABLE public.operaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin full access operaciones" ON public.operaciones;
CREATE POLICY "admin full access operaciones" ON public.operaciones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS contactos_set_updated_at ON public.contactos;
CREATE TRIGGER contactos_set_updated_at BEFORE UPDATE ON public.contactos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS operaciones_set_updated_at ON public.operaciones;
CREATE TRIGGER operaciones_set_updated_at BEFORE UPDATE ON public.operaciones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();