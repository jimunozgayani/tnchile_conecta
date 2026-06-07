
-- Move MV out of the public API surface
CREATE SCHEMA IF NOT EXISTS internal;

DO $$
BEGIN
  PERFORM cron.unschedule('refresh-admin-dashboard-stats')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-admin-dashboard-stats');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP FUNCTION IF EXISTS public.refresh_admin_dashboard_stats();
DROP MATERIALIZED VIEW IF EXISTS public.admin_dashboard_stats;

CREATE MATERIALIZED VIEW internal.admin_dashboard_stats AS
WITH
  active_suppliers AS (
    SELECT COUNT(*)::int AS n
    FROM public.profiles p
    WHERE p.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role = 'supplier')
  ),
  trucks_count AS (SELECT COUNT(*)::int AS n FROM public.trucks WHERE deleted_at IS NULL),
  drivers_count AS (SELECT COUNT(*)::int AS n FROM public.drivers WHERE deleted_at IS NULL),
  docs AS (
    SELECT fecha FROM (
      SELECT soap_vencimiento AS fecha FROM public.trucks WHERE deleted_at IS NULL AND soap_vencimiento IS NOT NULL
      UNION ALL SELECT permiso_circulacion_vencimiento FROM public.trucks WHERE deleted_at IS NULL AND permiso_circulacion_vencimiento IS NOT NULL
      UNION ALL SELECT revision_tecnica_vencimiento FROM public.trucks WHERE deleted_at IS NULL AND revision_tecnica_vencimiento IS NOT NULL
      UNION ALL SELECT licencia_vencimiento FROM public.drivers WHERE deleted_at IS NULL AND licencia_vencimiento IS NOT NULL
      UNION ALL SELECT carnet_vencimiento FROM public.drivers WHERE deleted_at IS NULL AND carnet_vencimiento IS NOT NULL
      UNION ALL SELECT poliza_seguro_vencimiento FROM public.profiles WHERE deleted_at IS NULL AND poliza_seguro_vencimiento IS NOT NULL
    ) d
  ),
  docs_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE fecha > CURRENT_DATE AND fecha <= CURRENT_DATE + 30)::int AS por_vencer,
      COUNT(*) FILTER (WHERE fecha <= CURRENT_DATE)::int AS vencidos
    FROM docs
  ),
  completeness AS (
    SELECT AVG(
      (
        (CASE WHEN p.razon_social IS NOT NULL AND p.razon_social <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.rut_empresa  IS NOT NULL AND p.rut_empresa  <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.nombre_contacto IS NOT NULL AND p.nombre_contacto <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.correo IS NOT NULL AND p.correo <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.telefono IS NOT NULL AND p.telefono <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.region IS NOT NULL AND p.region <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.direccion IS NOT NULL AND p.direccion <> '' THEN 1 ELSE 0 END) +
        (CASE WHEN p.poliza_seguro_vencimiento IS NOT NULL THEN 1 ELSE 0 END)
      )::numeric / 8 * 100
    )::numeric(5,2) AS pct
    FROM public.profiles p WHERE p.deleted_at IS NULL
  ),
  by_region AS (
    SELECT COALESCE(jsonb_object_agg(region, n), '{}'::jsonb) AS j FROM (
      SELECT COALESCE(p.region, 'Sin región') AS region, COUNT(*)::int AS n
      FROM public.profiles p WHERE p.deleted_at IS NULL
      GROUP BY COALESCE(p.region, 'Sin región')
    ) x
  ),
  by_tipo AS (
    SELECT COALESCE(jsonb_object_agg(tipo, n), '{}'::jsonb) AS j FROM (
      SELECT COALESCE(t.tipo, 'sin_tipo') AS tipo, COUNT(*)::int AS n
      FROM public.trucks t WHERE t.deleted_at IS NULL
      GROUP BY COALESCE(t.tipo, 'sin_tipo')
    ) x
  )
SELECT
  (SELECT n FROM active_suppliers) AS total_proveedores_activos,
  (SELECT n FROM trucks_count) AS total_camiones,
  (SELECT n FROM drivers_count) AS total_choferes,
  (SELECT por_vencer FROM docs_stats) AS docs_por_vencer_30d,
  (SELECT vencidos FROM docs_stats) AS docs_vencidos,
  COALESCE((SELECT pct FROM completeness), 0) AS cumplimiento_promedio_porcentaje,
  (SELECT j FROM by_region) AS proveedores_por_region,
  (SELECT j FROM by_tipo) AS tipos_camion_conteo,
  now() AS refreshed_at;

CREATE UNIQUE INDEX admin_dashboard_stats_singleton ON internal.admin_dashboard_stats ((1));

-- Admin-only accessor: SECURITY DEFINER, role-checked, exposed in public
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS internal.admin_dashboard_stats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE
  result internal.admin_dashboard_stats;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO result FROM internal.admin_dashboard_stats LIMIT 1;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- Refresh function restricted to service_role (used by cron / admin tooling)
CREATE OR REPLACE FUNCTION internal.refresh_admin_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = internal, public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY internal.admin_dashboard_stats;
END;
$$;

REVOKE ALL ON FUNCTION internal.refresh_admin_dashboard_stats() FROM PUBLIC, anon, authenticated;

-- Schedule refresh every 60 minutes
SELECT cron.schedule(
  'refresh-admin-dashboard-stats',
  '0 * * * *',
  $$SELECT internal.refresh_admin_dashboard_stats();$$
);
