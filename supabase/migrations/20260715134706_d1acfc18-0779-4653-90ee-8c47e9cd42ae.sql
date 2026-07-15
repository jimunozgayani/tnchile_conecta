
CREATE TYPE public.disponibilidad_estado AS ENUM ('disponible','no_disponible','sin_confirmar');

CREATE TABLE public.disponibilidad_camion (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camion_id UUID NOT NULL REFERENCES public.trucks(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  estado public.disponibilidad_estado NOT NULL DEFAULT 'sin_confirmar',
  lugar TEXT,
  destino TEXT,
  tipo_carga TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (camion_id, fecha)
);

CREATE INDEX idx_disponibilidad_camion_fecha ON public.disponibilidad_camion(fecha);
CREATE INDEX idx_disponibilidad_camion_camion ON public.disponibilidad_camion(camion_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disponibilidad_camion TO authenticated;
GRANT ALL ON public.disponibilidad_camion TO service_role;

ALTER TABLE public.disponibilidad_camion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all truck availability"
  ON public.disponibilidad_camion FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert truck availability"
  ON public.disponibilidad_camion FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update truck availability"
  ON public.disponibilidad_camion FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete truck availability"
  ON public.disponibilidad_camion FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER disponibilidad_camion_set_updated_at
  BEFORE UPDATE ON public.disponibilidad_camion
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();
