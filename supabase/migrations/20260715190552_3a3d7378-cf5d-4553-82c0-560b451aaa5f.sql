
-- Chofer profiles
CREATE TABLE public.chofer_perfiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rut TEXT NOT NULL,
  licencia_numero TEXT NOT NULL,
  proveedor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  estado_validacion TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_validacion IN ('pendiente','en_revision','aprobado','rechazado')),
  motivo_rechazo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.chofer_perfiles TO authenticated;
GRANT ALL ON public.chofer_perfiles TO service_role;

ALTER TABLE public.chofer_perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chofer sees own perfil" ON public.chofer_perfiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chofer inserts own perfil" ON public.chofer_perfiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chofer updates own perfil pending" ON public.chofer_perfiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND estado_validacion IN ('pendiente','rechazado'))
  WITH CHECK (auth.uid() = user_id AND estado_validacion IN ('pendiente','rechazado'));
CREATE POLICY "admin updates any perfil" ON public.chofer_perfiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER chofer_perfiles_updated BEFORE UPDATE ON public.chofer_perfiles
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();

-- Chofer documents
CREATE TABLE public.documentos_chofer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('licencia_conducir','cedula_identidad','foto_perfil')),
  storage_path TEXT NOT NULL,
  file_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX documentos_chofer_user_idx ON public.documentos_chofer(user_id, tipo);

GRANT SELECT, INSERT, DELETE ON public.documentos_chofer TO authenticated;
GRANT ALL ON public.documentos_chofer TO service_role;

ALTER TABLE public.documentos_chofer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chofer sees own docs" ON public.documentos_chofer
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "chofer inserts own docs" ON public.documentos_chofer
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "chofer deletes own docs pending" ON public.documentos_chofer
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.chofer_perfiles cp
      WHERE cp.user_id = auth.uid() AND cp.estado_validacion IN ('pendiente','rechazado')
    )
  );

-- Storage policies on driver-photos bucket for chofer self-upload under path {user_id}/*
CREATE POLICY "chofer upload own driver-photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'driver-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "chofer read own driver-photos" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'driver-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  );
CREATE POLICY "chofer delete own driver-photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'driver-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );
