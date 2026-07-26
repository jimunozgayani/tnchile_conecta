ALTER TABLE public.tipos_camion
  ADD COLUMN IF NOT EXISTS requiere_acople boolean NOT NULL DEFAULT false;

UPDATE public.tipos_camion SET requiere_acople = true
WHERE nombre IN (
  'Rampla Plana', 'Rampla Plana 28T', 'Rampla Fría/Thermo',
  'Rampla Furgonada/Paquetera', 'Cuello Cisne', 'Cama Baja'
);

ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS tipo_camion_id uuid REFERENCES public.tipos_camion(id),
  ADD COLUMN IF NOT EXISTS acoplado_a_truck_id uuid REFERENCES public.trucks(id);

-- Keep legacy free-text trucks.tipo synced with the catalog name
CREATE OR REPLACE FUNCTION public.trucks_sync_tipo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_camion_id IS NOT NULL THEN
    SELECT tc.nombre INTO NEW.tipo FROM public.tipos_camion tc WHERE tc.id = NEW.tipo_camion_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trucks_sync_tipo ON public.trucks;
CREATE TRIGGER trg_trucks_sync_tipo
BEFORE INSERT OR UPDATE OF tipo_camion_id ON public.trucks
FOR EACH ROW EXECUTE FUNCTION public.trucks_sync_tipo();

-- Keep coupling mutual on both sides
CREATE OR REPLACE FUNCTION public.trucks_sync_acople()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.acoplado_a_truck_id IS DISTINCT FROM OLD.acoplado_a_truck_id THEN
    IF OLD.acoplado_a_truck_id IS NOT NULL THEN
      UPDATE public.trucks SET acoplado_a_truck_id = NULL
      WHERE id = OLD.acoplado_a_truck_id AND acoplado_a_truck_id = NEW.id;
    END IF;
    IF NEW.acoplado_a_truck_id IS NOT NULL THEN
      UPDATE public.trucks SET acoplado_a_truck_id = NEW.id
      WHERE id = NEW.acoplado_a_truck_id
        AND acoplado_a_truck_id IS DISTINCT FROM NEW.id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_trucks_sync_acople ON public.trucks;
CREATE TRIGGER trg_trucks_sync_acople
AFTER INSERT OR UPDATE OF acoplado_a_truck_id ON public.trucks
FOR EACH ROW EXECUTE FUNCTION public.trucks_sync_acople();