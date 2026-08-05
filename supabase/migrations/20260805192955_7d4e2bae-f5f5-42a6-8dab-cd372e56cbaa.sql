ALTER TABLE public.cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_estado_check
CHECK (estado IN ('nueva','cotizada','en_revision','aceptada','lista_para_operar','confirmada','en_operacion','finalizada','cobro_pendiente','cerrada','rechazada'));