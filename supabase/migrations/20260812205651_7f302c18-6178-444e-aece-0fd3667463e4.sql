ALTER TABLE public.cotizaciones DROP CONSTRAINT IF EXISTS cotizaciones_estado_check;
ALTER TABLE public.cotizaciones ADD CONSTRAINT cotizaciones_estado_check CHECK (estado = ANY (ARRAY['nueva','cotizada','en_revision','aceptada','lista_para_operar','confirmada','en_operacion','finalizada','cobro_pendiente','cerrada','rechazada','en_exploracion','costo_fijado','pendiente_gate2','pendiente_gate3','exploracion_vencida']));

CREATE OR REPLACE FUNCTION public.cerrar_exploraciones_vencidas()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cot record;
BEGIN
  FOR v_cot IN
    SELECT id, contacto_nombre, exploracion_limite_at
    FROM public.cotizaciones
    WHERE estado = 'en_exploracion'
      AND exploracion_limite_at IS NOT NULL
      AND exploracion_limite_at < now()
  LOOP
    UPDATE public.cotizaciones SET estado = 'exploracion_vencida' WHERE id = v_cot.id;

    INSERT INTO public.notificaciones (
      user_id, entity_tipo, entity_id, entity_name, doc_tipo,
      fecha_vencimiento, dias_restantes, umbral, severidad
    )
    SELECT DISTINCT ur.user_id, 'cotizacion', v_cot.id,
      COALESCE(v_cot.contacto_nombre, 'Carga'),
      'Exploración vencida',
      (v_cot.exploracion_limite_at)::date, 0, 0, 'critical'
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::app_role, 'lider_cuenta'::app_role)
    ON CONFLICT (entity_tipo, entity_id, doc_tipo, fecha_vencimiento, umbral) DO NOTHING;

    INSERT INTO public.audit_log (tabla_nombre, registro_id, accion, datos_nuevos)
    VALUES ('cotizaciones', v_cot.id, 'exploracion_vencida',
      jsonb_build_object('cerrada_automaticamente', true,
                         'exploracion_limite_at', v_cot.exploracion_limite_at));
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.cerrar_exploraciones_vencidas() FROM PUBLIC, anon, authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cerrar-exploraciones-vencidas') THEN
    PERFORM cron.unschedule('cerrar-exploraciones-vencidas');
  END IF;
  PERFORM cron.schedule('cerrar-exploraciones-vencidas', '*/15 * * * *',
    $sql$SELECT public.cerrar_exploraciones_vencidas()$sql$);
END $$;