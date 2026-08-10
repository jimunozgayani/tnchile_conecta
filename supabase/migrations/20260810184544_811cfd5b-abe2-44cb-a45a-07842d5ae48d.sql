ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_accion_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_accion_check
  CHECK (
    accion = ANY (ARRAY['INSERT','UPDATE','DELETE'])
    OR accion ~ '^(estado_|asignacion_|exploracion_|propuesta_|ganadora_)[a-z_]+$'
  );

ALTER TABLE public.propuestas_proveedor REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.propuestas_proveedor;