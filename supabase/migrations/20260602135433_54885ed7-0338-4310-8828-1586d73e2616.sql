
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Estado columns
ALTER TABLE public.trucks    ADD COLUMN IF NOT EXISTS estado_doc TEXT;
ALTER TABLE public.drivers   ADD COLUMN IF NOT EXISTS estado_doc TEXT;
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS estado_doc TEXT;

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notificaciones (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL,
  entity_tipo        TEXT NOT NULL,   -- 'truck' | 'driver' | 'profile'
  entity_id          UUID NOT NULL,
  entity_name        TEXT,
  doc_tipo           TEXT NOT NULL,
  fecha_vencimiento  DATE NOT NULL,
  dias_restantes     INTEGER NOT NULL,
  umbral             INTEGER NOT NULL,   -- 30 | 15 | 7 | 0
  severidad          TEXT NOT NULL,      -- 'warning' | 'critical'
  leida              BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notificaciones_dedup UNIQUE (entity_tipo, entity_id, doc_tipo, fecha_vencimiento, umbral)
);

GRANT SELECT, UPDATE ON public.notificaciones TO authenticated;
GRANT ALL ON public.notificaciones TO service_role;

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
  ON public.notificaciones FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "admins read all notifications"
  ON public.notificaciones FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users mark own notifications read"
  ON public.notificaciones FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins mark notifications read"
  ON public.notificaciones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_notificaciones_user_unread
  ON public.notificaciones (user_id, leida, created_at DESC);

-- Worker function
CREATE OR REPLACE FUNCTION public.process_document_expiries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_days INT;
  v_threshold INT;
BEGIN
  FOR r IN
    SELECT 'truck'::text AS entity_tipo, t.id AS entity_id, t.user_id, t.patente AS entity_name,
           'SOAP'::text AS doc_tipo, t.soap_vencimiento AS fecha
    FROM public.trucks t
    WHERE t.deleted_at IS NULL AND t.soap_vencimiento IS NOT NULL
    UNION ALL
    SELECT 'truck', t.id, t.user_id, t.patente, 'Permiso de circulación', t.permiso_circulacion_vencimiento
    FROM public.trucks t WHERE t.deleted_at IS NULL AND t.permiso_circulacion_vencimiento IS NOT NULL
    UNION ALL
    SELECT 'truck', t.id, t.user_id, t.patente, 'Revisión técnica', t.revision_tecnica_vencimiento
    FROM public.trucks t WHERE t.deleted_at IS NULL AND t.revision_tecnica_vencimiento IS NOT NULL
    UNION ALL
    SELECT 'driver', d.id, d.user_id, d.nombre_completo, 'Licencia de conducir', d.licencia_vencimiento
    FROM public.drivers d WHERE d.deleted_at IS NULL AND d.licencia_vencimiento IS NOT NULL
    UNION ALL
    SELECT 'driver', d.id, d.user_id, d.nombre_completo, 'Carnet de identidad', d.carnet_vencimiento
    FROM public.drivers d WHERE d.deleted_at IS NULL AND d.carnet_vencimiento IS NOT NULL
    UNION ALL
    SELECT 'profile', p.id, p.id, COALESCE(p.razon_social, p.correo, '—'), 'Póliza de seguro', p.poliza_seguro_vencimiento
    FROM public.profiles p WHERE p.deleted_at IS NULL AND p.poliza_seguro_vencimiento IS NOT NULL
  LOOP
    v_days := (r.fecha - CURRENT_DATE);

    v_threshold := CASE
      WHEN v_days <= 0  THEN 0
      WHEN v_days <= 7  THEN 7
      WHEN v_days <= 15 THEN 15
      WHEN v_days <= 30 THEN 30
      ELSE NULL
    END;

    IF v_threshold IS NOT NULL THEN
      INSERT INTO public.notificaciones (
        user_id, entity_tipo, entity_id, entity_name, doc_tipo,
        fecha_vencimiento, dias_restantes, umbral, severidad
      )
      VALUES (
        r.user_id, r.entity_tipo, r.entity_id, r.entity_name, r.doc_tipo,
        r.fecha, v_days, v_threshold,
        CASE WHEN v_days <= 7 THEN 'critical' ELSE 'warning' END
      )
      ON CONFLICT (entity_tipo, entity_id, doc_tipo, fecha_vencimiento, umbral) DO NOTHING;
    END IF;
  END LOOP;

  -- Roll up estado_doc per entity (worst of its dates)
  UPDATE public.trucks t SET estado_doc = sub.estado FROM (
    SELECT id, CASE
      WHEN MIN(d) <= CURRENT_DATE THEN 'vencido'
      WHEN MIN(d) <= CURRENT_DATE + 30 THEN 'por_vencer'
      ELSE 'vigente'
    END AS estado
    FROM (
      SELECT id, soap_vencimiento AS d FROM public.trucks WHERE soap_vencimiento IS NOT NULL AND deleted_at IS NULL
      UNION ALL SELECT id, permiso_circulacion_vencimiento FROM public.trucks WHERE permiso_circulacion_vencimiento IS NOT NULL AND deleted_at IS NULL
      UNION ALL SELECT id, revision_tecnica_vencimiento FROM public.trucks WHERE revision_tecnica_vencimiento IS NOT NULL AND deleted_at IS NULL
    ) x GROUP BY id
  ) sub WHERE t.id = sub.id;

  UPDATE public.drivers dr SET estado_doc = sub.estado FROM (
    SELECT id, CASE
      WHEN MIN(d) <= CURRENT_DATE THEN 'vencido'
      WHEN MIN(d) <= CURRENT_DATE + 30 THEN 'por_vencer'
      ELSE 'vigente'
    END AS estado
    FROM (
      SELECT id, licencia_vencimiento AS d FROM public.drivers WHERE licencia_vencimiento IS NOT NULL AND deleted_at IS NULL
      UNION ALL SELECT id, carnet_vencimiento FROM public.drivers WHERE carnet_vencimiento IS NOT NULL AND deleted_at IS NULL
    ) x GROUP BY id
  ) sub WHERE dr.id = sub.id;

  UPDATE public.profiles p SET estado_doc = CASE
    WHEN p.poliza_seguro_vencimiento IS NULL THEN NULL
    WHEN p.poliza_seguro_vencimiento <= CURRENT_DATE THEN 'vencido'
    WHEN p.poliza_seguro_vencimiento <= CURRENT_DATE + 30 THEN 'por_vencer'
    ELSE 'vigente'
  END WHERE p.deleted_at IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_document_expiries() FROM PUBLIC, anon, authenticated;

-- Schedule daily at 08:00 Chile (UTC-3) = 11:00 UTC
SELECT cron.unschedule('process-document-expiries-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-document-expiries-daily');

SELECT cron.schedule(
  'process-document-expiries-daily',
  '0 11 * * *',
  $cron$ SELECT public.process_document_expiries(); $cron$
);

-- Initial run so data is populated immediately
SELECT public.process_document_expiries();
