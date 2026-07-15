
-- ================= ciudades_chile =================
CREATE TABLE IF NOT EXISTS public.ciudades_chile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  region text NOT NULL,
  lat numeric,
  lng numeric,
  UNIQUE (nombre, region)
);

GRANT SELECT ON public.ciudades_chile TO authenticated, anon;
GRANT ALL ON public.ciudades_chile TO service_role;
ALTER TABLE public.ciudades_chile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ciudades públicas" ON public.ciudades_chile FOR SELECT USING (true);

INSERT INTO public.ciudades_chile (nombre, region, lat, lng) VALUES
  ('Arica','Arica y Parinacota',-18.4783,-70.3126),
  ('Iquique','Tarapacá',-20.2208,-70.1431),
  ('Alto Hospicio','Tarapacá',-20.2708,-70.1075),
  ('Antofagasta','Antofagasta',-23.6509,-70.3975),
  ('Calama','Antofagasta',-22.4667,-68.9333),
  ('Mejillones','Antofagasta',-23.1017,-70.4508),
  ('Tocopilla','Antofagasta',-22.0919,-70.2019),
  ('Copiapó','Atacama',-27.3667,-70.3333),
  ('Vallenar','Atacama',-28.5708,-70.7583),
  ('Caldera','Atacama',-27.0672,-70.8228),
  ('La Serena','Coquimbo',-29.9027,-71.2519),
  ('Coquimbo','Coquimbo',-29.9533,-71.3436),
  ('Ovalle','Coquimbo',-30.6011,-71.1994),
  ('Illapel','Coquimbo',-31.6314,-71.1656),
  ('Valparaíso','Valparaíso',-33.0472,-71.6127),
  ('Viña del Mar','Valparaíso',-33.0245,-71.5518),
  ('Quilpué','Valparaíso',-33.0472,-71.4419),
  ('Villa Alemana','Valparaíso',-33.0417,-71.375),
  ('San Antonio','Valparaíso',-33.5928,-71.6067),
  ('Quillota','Valparaíso',-32.8811,-71.2489),
  ('San Felipe','Valparaíso',-32.75,-70.7239),
  ('Los Andes','Valparaíso',-32.8339,-70.5983),
  ('Rancagua','O''Higgins',-34.1708,-70.7444),
  ('San Fernando','O''Higgins',-34.585,-70.9892),
  ('Machalí','O''Higgins',-34.1783,-70.65),
  ('Talca','Maule',-35.4264,-71.6553),
  ('Curicó','Maule',-34.9828,-71.2394),
  ('Linares','Maule',-35.85,-71.5983),
  ('Constitución','Maule',-35.3333,-72.4167),
  ('Chillán','Ñuble',-36.6067,-72.1033),
  ('San Carlos','Ñuble',-36.4239,-71.9578),
  ('Concepción','Biobío',-36.8269,-73.0498),
  ('Talcahuano','Biobío',-36.7167,-73.1167),
  ('Los Ángeles','Biobío',-37.4694,-72.3536),
  ('Coronel','Biobío',-37.0333,-73.15),
  ('Chiguayante','Biobío',-36.9167,-73.0167),
  ('San Pedro de la Paz','Biobío',-36.85,-73.1),
  ('Hualpén','Biobío',-36.7833,-73.1167),
  ('Temuco','Araucanía',-38.7359,-72.5904),
  ('Padre Las Casas','Araucanía',-38.7667,-72.6),
  ('Villarrica','Araucanía',-39.2833,-72.2333),
  ('Angol','Araucanía',-37.795,-72.7161),
  ('Valdivia','Los Ríos',-39.8142,-73.2459),
  ('La Unión','Los Ríos',-40.29,-73.08),
  ('Puerto Montt','Los Lagos',-41.4718,-72.9366),
  ('Osorno','Los Lagos',-40.5717,-73.135),
  ('Castro','Los Lagos',-42.4794,-73.7622),
  ('Ancud','Los Lagos',-41.8697,-73.8203),
  ('Coyhaique','Aysén',-45.5712,-72.0685),
  ('Puerto Aysén','Aysén',-45.4033,-72.6931),
  ('Punta Arenas','Magallanes',-53.1638,-70.9171),
  ('Puerto Natales','Magallanes',-51.7236,-72.4869),
  ('Santiago','Metropolitana',-33.4489,-70.6693),
  ('Puente Alto','Metropolitana',-33.6111,-70.575),
  ('Maipú','Metropolitana',-33.5111,-70.7583),
  ('La Florida','Metropolitana',-33.5228,-70.5983),
  ('San Bernardo','Metropolitana',-33.5928,-70.7),
  ('Las Condes','Metropolitana',-33.4172,-70.5476),
  ('Ñuñoa','Metropolitana',-33.4569,-70.5981),
  ('Providencia','Metropolitana',-33.4314,-70.6094),
  ('Melipilla','Metropolitana',-33.6883,-71.2158),
  ('Colina','Metropolitana',-33.2,-70.6833),
  ('Talagante','Metropolitana',-33.6647,-70.9269),
  ('Buin','Metropolitana',-33.7333,-70.7333)
ON CONFLICT (nombre, region) DO NOTHING;

-- Helper: driver ids the current authenticated chofer is linked to (RUT + supplier match)
CREATE OR REPLACE FUNCTION public.chofer_driver_ids(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.id
  FROM public.drivers d
  JOIN public.chofer_perfiles cp
    ON cp.user_id = _uid
   AND cp.estado_validacion = 'aprobado'
   AND cp.proveedor_id = d.user_id
   AND lower(regexp_replace(coalesce(cp.rut,''),'[^0-9kK]','','g'))
     = lower(regexp_replace(coalesce(d.rut,''),'[^0-9kK]','','g'))
  WHERE d.deleted_at IS NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.chofer_driver_ids(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chofer_driver_ids(uuid) TO authenticated;

-- ================= disponibilidad_chofer =================
CREATE TABLE IF NOT EXISTS public.disponibilidad_chofer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  fecha_desde date NOT NULL,
  fecha_hasta date NOT NULL,
  estado text NOT NULL CHECK (estado IN ('disponible','no_disponible')),
  lugar_ciudad_id uuid REFERENCES public.ciudades_chile(id),
  lugar_texto text,
  destino_ciudad_id uuid REFERENCES public.ciudades_chile(id),
  destino_texto text,
  modalidad text CHECK (modalidad IN ('consolidado','rampla_completa')),
  truck_id uuid REFERENCES public.trucks(id) ON DELETE SET NULL,
  notas text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS disp_chofer_driver_fecha_idx
  ON public.disponibilidad_chofer(driver_id, fecha_desde);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.disponibilidad_chofer TO authenticated;
GRANT ALL ON public.disponibilidad_chofer TO service_role;
ALTER TABLE public.disponibilidad_chofer ENABLE ROW LEVEL SECURITY;

-- Supplier: full CRUD over their own drivers
CREATE POLICY "Proveedor ve disp de sus choferes"
  ON public.disponibilidad_chofer FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Proveedor inserta disp de sus choferes"
  ON public.disponibilidad_chofer FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Proveedor actualiza disp de sus choferes"
  ON public.disponibilidad_chofer FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));
CREATE POLICY "Proveedor elimina disp de sus choferes"
  ON public.disponibilidad_chofer FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = driver_id AND d.user_id = auth.uid()));

-- Chofer aprobado: CRUD sobre su propia disp (link por RUT + proveedor)
CREATE POLICY "Chofer ve su disp"
  ON public.disponibilidad_chofer FOR SELECT TO authenticated
  USING (driver_id IN (SELECT public.chofer_driver_ids(auth.uid())));
CREATE POLICY "Chofer inserta su disp"
  ON public.disponibilidad_chofer FOR INSERT TO authenticated
  WITH CHECK (driver_id IN (SELECT public.chofer_driver_ids(auth.uid())));
CREATE POLICY "Chofer actualiza su disp"
  ON public.disponibilidad_chofer FOR UPDATE TO authenticated
  USING (driver_id IN (SELECT public.chofer_driver_ids(auth.uid())))
  WITH CHECK (driver_id IN (SELECT public.chofer_driver_ids(auth.uid())));
CREATE POLICY "Chofer elimina su disp"
  ON public.disponibilidad_chofer FOR DELETE TO authenticated
  USING (driver_id IN (SELECT public.chofer_driver_ids(auth.uid())));

-- Admin lee todo
CREATE POLICY "Admin ve toda la disp"
  ON public.disponibilidad_chofer FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER disp_chofer_set_updated_at
  BEFORE UPDATE ON public.disponibilidad_chofer
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();
