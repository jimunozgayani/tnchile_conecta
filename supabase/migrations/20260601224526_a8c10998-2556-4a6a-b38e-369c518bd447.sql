-- 1. Soft-delete columns
ALTER TABLE public.trucks    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.drivers   ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.rates     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trucks_deleted_at    ON public.trucks    (deleted_at);
CREATE INDEX IF NOT EXISTS idx_drivers_deleted_at   ON public.drivers   (deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON public.documents (deleted_at);
CREATE INDEX IF NOT EXISTS idx_rates_deleted_at     ON public.rates     (deleted_at);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at  ON public.profiles  (deleted_at);

-- 2. Audit log table
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tabla_nombre TEXT NOT NULL,
  registro_id UUID,
  accion TEXT NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  usuario_id UUID,
  usuario_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
CREATE INDEX idx_audit_log_usuario    ON public.audit_log (usuario_id);
CREATE INDEX idx_audit_log_registro   ON public.audit_log (tabla_nombre, registro_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read all audit"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own audit"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- 3. Trigger function
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  EXCEPTION WHEN OTHERS THEN v_email := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_new := NULL;
    v_record_id := (OLD).id;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := to_jsonb(NEW);
    v_record_id := (NEW).id;
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    v_record_id := (NEW).id;
  END IF;

  INSERT INTO public.audit_log (tabla_nombre, registro_id, accion, datos_anteriores, datos_nuevos, usuario_id, usuario_email)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_old, v_new, v_user_id, v_email);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Triggers on tracked tables (proveedores = profiles)
DROP TRIGGER IF EXISTS audit_trucks    ON public.trucks;
DROP TRIGGER IF EXISTS audit_drivers   ON public.drivers;
DROP TRIGGER IF EXISTS audit_documents ON public.documents;
DROP TRIGGER IF EXISTS audit_rates     ON public.rates;
DROP TRIGGER IF EXISTS audit_profiles  ON public.profiles;

CREATE TRIGGER audit_trucks    AFTER INSERT OR UPDATE OR DELETE ON public.trucks    FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_drivers   AFTER INSERT OR UPDATE OR DELETE ON public.drivers   FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_rates     AFTER INSERT OR UPDATE OR DELETE ON public.rates     FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();
CREATE TRIGGER audit_profiles  AFTER INSERT OR UPDATE OR DELETE ON public.profiles  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();