ALTER TABLE public.asignaciones
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id);
ALTER TABLE public.asignaciones ALTER COLUMN camion_id DROP NOT NULL;