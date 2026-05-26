
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  razon_social TEXT,
  rut_empresa TEXT,
  nombre_contacto TEXT,
  cargo TEXT,
  correo TEXT,
  telefono TEXT,
  direccion TEXT,
  region TEXT,
  poliza_seguro_url TEXT,
  poliza_seguro_vencimiento DATE,
  certificado_sii_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, correo) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trucks
CREATE TABLE public.trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patente TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  anio INTEGER,
  tipo TEXT,
  capacidad_toneladas NUMERIC,
  numero_ejes INTEGER,
  soap_vencimiento DATE,
  permiso_circulacion_vencimiento DATE,
  revision_tecnica_vencimiento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trucks TO authenticated;
GRANT ALL ON public.trucks TO service_role;
ALTER TABLE public.trucks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own trucks select" ON public.trucks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own trucks insert" ON public.trucks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own trucks update" ON public.trucks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own trucks delete" ON public.trucks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Drivers
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  rut TEXT,
  celular TEXT,
  clase_licencia TEXT,
  licencia_vencimiento DATE,
  carnet_vencimiento DATE,
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own drivers select" ON public.drivers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own drivers insert" ON public.drivers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own drivers update" ON public.drivers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own drivers delete" ON public.drivers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Rates
CREATE TABLE public.rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origen TEXT NOT NULL,
  destino TEXT NOT NULL,
  tipo_camion TEXT,
  precio_base_clp NUMERIC,
  precio_km_adicional NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rates TO authenticated;
GRANT ALL ON public.rates TO service_role;
ALTER TABLE public.rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rates select" ON public.rates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own rates insert" ON public.rates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own rates update" ON public.rates FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own rates delete" ON public.rates FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  nombre TEXT,
  file_url TEXT NOT NULL,
  vencimiento DATE,
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own docs select" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own docs insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own docs update" ON public.documents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own docs delete" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-photos', 'driver-photos', true);

-- Storage policies: users access only their own folder (folder name = user_id)
CREATE POLICY "own docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own docs upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own docs update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "own docs delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "driver photos read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'driver-photos');
CREATE POLICY "driver photos upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "driver photos update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'driver-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "driver photos delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'driver-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
