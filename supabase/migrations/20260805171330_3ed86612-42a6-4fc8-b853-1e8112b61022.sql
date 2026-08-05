ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_accion_check;
ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_accion_check
  CHECK (accion IN ('INSERT','UPDATE','DELETE') OR accion ~ '^(estado_|asignacion_)[a-z_]+$');