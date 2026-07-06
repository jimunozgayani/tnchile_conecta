
CREATE OR REPLACE FUNCTION public.process_document_expiries()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT 'poliza', po.id, po.proveedor_id,
           COALESCE(po.numero_poliza, po.aseguradora, 'Póliza'),
           'Póliza de seguro', po.fecha_vencimiento
    FROM public.polizas po
    WHERE po.deleted_at IS NULL
      AND po.fecha_vencimiento IS NOT NULL
      AND COALESCE(po.activa, true) = true
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

  -- Roll up profile estado_doc from the polizas table (worst active policy)
  UPDATE public.profiles p SET estado_doc = sub.estado FROM (
    SELECT proveedor_id, CASE
      WHEN MIN(fecha_vencimiento) <= CURRENT_DATE THEN 'vencido'
      WHEN MIN(fecha_vencimiento) <= CURRENT_DATE + 30 THEN 'por_vencer'
      ELSE 'vigente'
    END AS estado
    FROM public.polizas
    WHERE deleted_at IS NULL AND fecha_vencimiento IS NOT NULL AND COALESCE(activa, true) = true
    GROUP BY proveedor_id
  ) sub WHERE p.id = sub.proveedor_id AND p.deleted_at IS NULL;

  UPDATE public.profiles p SET estado_doc = NULL
  WHERE p.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.polizas po
      WHERE po.proveedor_id = p.id AND po.deleted_at IS NULL
        AND po.fecha_vencimiento IS NOT NULL AND COALESCE(po.activa, true) = true
    );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.process_document_expiries() FROM PUBLIC, anon, authenticated;
