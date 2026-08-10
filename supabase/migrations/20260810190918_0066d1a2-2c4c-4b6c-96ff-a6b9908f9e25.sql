-- 1. Drop the existing broken trigger
DROP TRIGGER IF EXISTS propuestas_proveedor_actualizado_at
  ON public.propuestas_proveedor;

-- 2. Create a dedicated trigger function for propuestas_proveedor's actual column name
CREATE OR REPLACE FUNCTION public.propuestas_proveedor_set_actualizado_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.actualizado_at = now();
  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger using the new function
CREATE TRIGGER propuestas_proveedor_actualizado_at
  BEFORE UPDATE ON public.propuestas_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.propuestas_proveedor_set_actualizado_at();
