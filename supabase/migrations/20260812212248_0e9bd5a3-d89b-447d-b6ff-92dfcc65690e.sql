ALTER TABLE public.propuestas_proveedor
  ADD COLUMN IF NOT EXISTS ronda integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS propuestas_proveedor_cotizacion_ronda_idx
  ON public.propuestas_proveedor (cotizacion_id, ronda);