CREATE OR REPLACE FUNCTION public.crear_solicitud_carga(_payload jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := nullif(trim(_payload->>'email'), '');
  v_contacto_id uuid;
  v_cotizacion_id uuid;
BEGIN
  IF nullif(trim(_payload->>'nombre'), '') IS NULL THEN
    RAISE EXCEPTION 'nombre requerido';
  END IF;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'email requerido';
  END IF;

  SELECT id INTO v_contacto_id
  FROM public.contactos
  WHERE lower(email) = lower(v_email) AND deleted_at IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_contacto_id IS NULL THEN
    INSERT INTO public.contactos (nombre, empresa, rut, telefono, email, origen_contacto, temperatura, etapa_comercial)
    VALUES (
      left(trim(_payload->>'nombre'), 200),
      nullif(trim(_payload->>'empresa'), ''),
      nullif(trim(_payload->>'rut'), ''),
      nullif(trim(_payload->>'telefono'), ''),
      v_email,
      'formulario_web', 'tibio', 'lead'
    )
    RETURNING id INTO v_contacto_id;
  ELSE
    -- Anonymous submitters cannot prove ownership of the email, so existing
    -- contact data is never overwritten: only empty fields are filled in.
    UPDATE public.contactos
       SET telefono = COALESCE(telefono, nullif(trim(_payload->>'telefono'), '')),
           empresa  = COALESCE(empresa,  nullif(trim(_payload->>'empresa'), '')),
           rut      = COALESCE(rut,      nullif(trim(_payload->>'rut'), '')),
           updated_at = now()
     WHERE id = v_contacto_id;
  END IF;

  INSERT INTO public.cotizaciones (
    contacto_id, origen, destinos, estado, modalidad,
    tipo_camion_id, tipo_camion_otro, tipo_camion,
    peso_kg, largo_cm, ancho_cm, alto_cm,
    fecha_despacho, fotos, lineas_servicio, notas_admin,
    contacto_nombre, contacto_telefono, contacto_email
  ) VALUES (
    v_contacto_id,
    left(coalesce(nullif(trim(_payload->>'origen'), ''), 'Sin especificar'), 300),
    coalesce(_payload->'destinos', '[]'::jsonb),
    'nueva',
    'completo',
    nullif(_payload->>'tipo_camion_id','')::uuid,
    nullif(trim(_payload->>'tipo_camion_otro'), ''),
    nullif(trim(_payload->>'tipo_camion'), ''),
    nullif(_payload->>'peso_kg','')::numeric,
    nullif(_payload->>'largo_cm','')::numeric,
    nullif(_payload->>'ancho_cm','')::numeric,
    nullif(_payload->>'alto_cm','')::numeric,
    nullif(_payload->>'fecha_despacho','')::date,
    coalesce(_payload->'fotos', '[]'::jsonb),
    coalesce(_payload->'lineas_servicio', '[]'::jsonb),
    nullif(trim(_payload->>'notas_admin'), ''),
    left(trim(_payload->>'nombre'), 200),
    nullif(trim(_payload->>'telefono'), ''),
    v_email
  )
  RETURNING id INTO v_cotizacion_id;

  RETURN v_cotizacion_id;
END;
$function$;