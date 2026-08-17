ALTER TABLE public.operaciones
  ADD COLUMN IF NOT EXISTS chofer_id uuid REFERENCES public.drivers(id),
  ADD COLUMN IF NOT EXISTS chofer_nombre_libre text,
  ADD COLUMN IF NOT EXISTS chofer_rut_libre text,
  ADD COLUMN IF NOT EXISTS patente_principal text,
  ADD COLUMN IF NOT EXISTS patente_secundaria text,
  ADD COLUMN IF NOT EXISTS carga_hora_desde time,
  ADD COLUMN IF NOT EXISTS carga_hora_hasta time,
  ADD COLUMN IF NOT EXISTS descarga_fecha date,
  ADD COLUMN IF NOT EXISTS descarga_hora_desde time,
  ADD COLUMN IF NOT EXISTS descarga_hora_hasta time,
  ADD COLUMN IF NOT EXISTS descarga_notas text;