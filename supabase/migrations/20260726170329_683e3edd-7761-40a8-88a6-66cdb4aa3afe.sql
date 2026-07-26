CREATE OR REPLACE FUNCTION public.upsert_disponibilidad_dia(
  _driver_id uuid,
  _fecha date,
  _estado text DEFAULT NULL,
  _lugar_ciudad_id uuid DEFAULT NULL,
  _lugar_texto text DEFAULT NULL,
  _destino_ciudad_id uuid DEFAULT NULL,
  _destino_texto text DEFAULT NULL,
  _modalidad text DEFAULT NULL,
  _tipo_camion_id uuid DEFAULT NULL,
  _tipo_camion_otro text DEFAULT NULL,
  _fuente text DEFAULT 'operaciones'
) RETURNS public.disponibilidad_chofer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.disponibilidad_chofer;
BEGIN
  IF _fecha < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede modificar disponibilidad de una fecha pasada (%).', _fecha;
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Solo operaciones puede usar esta funcion.';
  END IF;

  INSERT INTO public.disponibilidad_chofer (
    driver_id, fecha_desde, fecha_hasta, estado,
    lugar_ciudad_id, lugar_texto, destino_ciudad_id, destino_texto,
    modalidad, tipo_camion_id, tipo_camion_otro, fuente, created_by
  ) VALUES (
    _driver_id, _fecha, _fecha, COALESCE(_estado, 'disponible'),
    _lugar_ciudad_id, _lugar_texto, _destino_ciudad_id, _destino_texto,
    _modalidad, _tipo_camion_id, _tipo_camion_otro, COALESCE(_fuente, 'operaciones'), auth.uid()
  )
  ON CONFLICT (driver_id, fecha_desde) WHERE fecha_desde = fecha_hasta
  DO UPDATE SET
    estado = COALESCE(_estado, disponibilidad_chofer.estado),
    lugar_ciudad_id = COALESCE(EXCLUDED.lugar_ciudad_id, disponibilidad_chofer.lugar_ciudad_id),
    lugar_texto = COALESCE(EXCLUDED.lugar_texto, disponibilidad_chofer.lugar_texto),
    destino_ciudad_id = COALESCE(EXCLUDED.destino_ciudad_id, disponibilidad_chofer.destino_ciudad_id),
    destino_texto = COALESCE(EXCLUDED.destino_texto, disponibilidad_chofer.destino_texto),
    modalidad = COALESCE(EXCLUDED.modalidad, disponibilidad_chofer.modalidad),
    tipo_camion_id = COALESCE(EXCLUDED.tipo_camion_id, disponibilidad_chofer.tipo_camion_id),
    tipo_camion_otro = COALESCE(EXCLUDED.tipo_camion_otro, disponibilidad_chofer.tipo_camion_otro),
    fuente = EXCLUDED.fuente,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_disponibilidad_dia(uuid, date, text, uuid, text, uuid, text, text, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_disponibilidad_dia(uuid, date, text, uuid, text, uuid, text, text, uuid, text, text) TO authenticated;