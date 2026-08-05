ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS revision_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comentarios_revision text,
  ADD COLUMN IF NOT EXISTS comentarios_rechazo text,
  ADD COLUMN IF NOT EXISTS rechazada_at timestamptz,
  ADD COLUMN IF NOT EXISTS asignado_a uuid REFERENCES auth.users(id);