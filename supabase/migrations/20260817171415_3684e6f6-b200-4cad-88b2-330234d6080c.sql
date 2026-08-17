UPDATE public.propuestas_proveedor
SET chofer_nombre_libre = COALESCE(chofer_nombre_libre, 'Pedro Soto Ramírez'),
    chofer_rut_libre = COALESCE(chofer_rut_libre, '12.345.678-5'),
    patente_principal = COALESCE(patente_principal, 'JKLM-12'),
    patente_secundaria = COALESCE(patente_secundaria, 'RM-8845')
WHERE id = 'e02ca91b-3767-4a97-a255-ca82b6fc80ea';