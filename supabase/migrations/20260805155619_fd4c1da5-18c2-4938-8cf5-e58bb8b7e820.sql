ALTER TABLE public.tarifas
  ADD COLUMN IF NOT EXISTS region_origen_new text,
  ADD COLUMN IF NOT EXISTS region_destino_new text;

DELETE FROM public.tarifas;

ALTER TABLE public.tarifas
  DROP COLUMN IF EXISTS region_origen,
  DROP COLUMN IF EXISTS region_destino;

ALTER TABLE public.tarifas RENAME COLUMN region_origen_new TO region_origen;
ALTER TABLE public.tarifas RENAME COLUMN region_destino_new TO region_destino;

ALTER TABLE public.tarifas ALTER COLUMN region_origen SET NOT NULL;
ALTER TABLE public.tarifas ALTER COLUMN region_destino SET NOT NULL;