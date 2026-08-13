ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS presupuesto_referencial_cliente_clp numeric;

COMMENT ON COLUMN public.cotizaciones.presupuesto_referencial_cliente_clp IS
  'Referencia informal levantada por el ejecutivo comercial: monto que el cliente comento estar dispuesto a pagar. NO es el precio oficial (ver precio_ofrecido_cliente_clp).';