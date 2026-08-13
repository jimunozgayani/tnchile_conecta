ALTER TABLE public.propuestas_proveedor
  ADD COLUMN IF NOT EXISTS tipo_pago text
  CHECK (tipo_pago IN ('contado', '50_50', '15_dias', '30_dias'));