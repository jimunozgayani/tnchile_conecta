CREATE OR REPLACE FUNCTION public.elegir_ganadora_y_fijar_precio(
  p_propuesta_id uuid,
  p_precio_ofrecido_cliente_clp numeric,
  p_tipo_pago text DEFAULT NULL,
  p_validez_hasta date DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotizacion_id uuid;
  v_costo_clp numeric;
  v_proveedor text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'lider_cuenta'::app_role)) THEN
    RAISE EXCEPTION 'Solo admin o lider de cuenta puede elegir la ganadora y cotizar.'
      USING ERRCODE = '42501';
  END IF;

  SELECT cotizacion_id, costo_clp, proveedor_nombre
    INTO v_cotizacion_id, v_costo_clp, v_proveedor
  FROM public.propuestas_proveedor WHERE id = p_propuesta_id;

  IF v_cotizacion_id IS NULL THEN
    RAISE EXCEPTION 'Propuesta no encontrada.';
  END IF;

  UPDATE public.propuestas_proveedor SET estado = 'ganadora'
    WHERE id = p_propuesta_id;

  UPDATE public.propuestas_proveedor SET estado = 'descartada'
    WHERE cotizacion_id = v_cotizacion_id AND id <> p_propuesta_id;

  UPDATE public.cotizaciones SET
    costo_proveedor_fijado_clp = v_costo_clp,
    propuesta_ganadora_id = p_propuesta_id,
    precio_ofrecido_cliente_clp = p_precio_ofrecido_cliente_clp,
    tipo_pago = COALESCE(p_tipo_pago, tipo_pago),
    validez_hasta = COALESCE(p_validez_hasta, validez_hasta),
    estado = 'cotizada'
  WHERE id = v_cotizacion_id;

  INSERT INTO public.audit_log (tabla_nombre, registro_id, accion, datos_nuevos, usuario_id)
  VALUES ('propuestas_proveedor', p_propuesta_id, 'ganadora_elegida_y_cotizada',
    jsonb_build_object(
      'propuesta_id', p_propuesta_id,
      'cotizacion_id', v_cotizacion_id,
      'proveedor_nombre', v_proveedor,
      'costo_clp', v_costo_clp,
      'precio_ofrecido_cliente_clp', p_precio_ofrecido_cliente_clp
    ), auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.elegir_ganadora_y_fijar_precio(uuid, numeric, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.elegir_ganadora_y_fijar_precio(uuid, numeric, text, date) TO authenticated, service_role;