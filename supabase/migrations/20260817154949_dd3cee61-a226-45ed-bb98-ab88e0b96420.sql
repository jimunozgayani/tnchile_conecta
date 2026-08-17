-- STEP 1 — Loading/unloading time window fields on cotizaciones
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS carga_hora_desde time,
  ADD COLUMN IF NOT EXISTS carga_hora_hasta time,
  ADD COLUMN IF NOT EXISTS descarga_fecha date,
  ADD COLUMN IF NOT EXISTS descarga_hora_desde time,
  ADD COLUMN IF NOT EXISTS descarga_hora_hasta time,
  ADD COLUMN IF NOT EXISTS descarga_notas text;

-- STEP 2 — Proposal driver/patente fields on propuestas_proveedor
ALTER TABLE public.propuestas_proveedor
  ADD COLUMN IF NOT EXISTS chofer_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS chofer_nombre_libre text,
  ADD COLUMN IF NOT EXISTS chofer_rut_libre text,
  ADD COLUMN IF NOT EXISTS proveedor_es_chofer boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS patente_principal text,
  ADD COLUMN IF NOT EXISTS patente_secundaria text;