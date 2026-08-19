ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS preparada_exploracion_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparada_exploracion_por uuid REFERENCES auth.users(id);