
CREATE TABLE public.driver_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  truck_type text,
  location text,
  destination text,
  load_status text NOT NULL DEFAULT 'consolidando' CHECK (load_status IN ('consolidando','rampla_completa')),
  availability jsonb NOT NULL DEFAULT '[0,0,0,0,0,0,0]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_availability TO authenticated;
GRANT ALL ON public.driver_availability TO service_role;

ALTER TABLE public.driver_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage driver_availability"
  ON public.driver_availability
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER driver_availability_set_updated_at
  BEFORE UPDATE ON public.driver_availability
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();
