ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE public.cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_estado_check CHECK (estado = ANY (ARRAY[
  'nueva','cotizada','en_revision','aceptada','lista_para_operar','confirmada','en_operacion',
  'finalizada','cobro_pendiente','cerrada','rechazada','en_exploracion','costo_fijado',
  'pendiente_gate2','pendiente_gate3','exploracion_vencida','eliminada'
]));

CREATE INDEX IF NOT EXISTS cotizaciones_deleted_at_idx ON public.cotizaciones (deleted_at);