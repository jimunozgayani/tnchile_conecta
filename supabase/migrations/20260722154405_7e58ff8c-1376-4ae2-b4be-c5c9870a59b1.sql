CREATE OR REPLACE FUNCTION public.chofer_driver_ids(_uid uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Reliable path: drivers explicitly linked to this auth user
  -- (invitation claims and owner-drivers)
  SELECT d.id
  FROM public.drivers d
  WHERE d.user_id = _uid
    AND d.deleted_at IS NULL

  UNION

  -- Legacy fallback: RUT-normalized match for unclaimed driver rows
  -- that still have no user_id set from the old self-registration flow
  SELECT d.id
  FROM public.drivers d
  JOIN public.chofer_perfiles cp
    ON cp.user_id = _uid
   AND cp.estado_validacion = 'aprobado'
   AND cp.proveedor_id = d.user_id
   AND lower(regexp_replace(coalesce(cp.rut,''),'[^0-9kK]','','g'))
     = lower(regexp_replace(coalesce(d.rut,''),'[^0-9kK]','','g'))
  WHERE d.deleted_at IS NULL
    AND d.user_id IS NULL;
$function$