
-- Enum for event types
DO $$ BEGIN
  CREATE TYPE public.evento_viaje_tipo AS ENUM (
    'cambio_estado','foto_guia','foto_carga','foto_descarga','nota'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.eventos_viaje (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES public.asignaciones(id) ON DELETE CASCADE,
  chofer_id uuid NOT NULL,
  tipo public.evento_viaje_tipo NOT NULL,
  estado_viaje text,
  storage_path text,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eventos_viaje_asig_idx ON public.eventos_viaje(asignacion_id, created_at DESC);

GRANT SELECT, INSERT ON public.eventos_viaje TO authenticated;
GRANT ALL ON public.eventos_viaje TO service_role;

ALTER TABLE public.eventos_viaje ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chofer inserta sus eventos"
  ON public.eventos_viaje FOR INSERT TO authenticated
  WITH CHECK (
    chofer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.asignaciones a WHERE a.id = asignacion_id AND a.chofer_id = auth.uid())
  );

CREATE POLICY "Chofer ve sus eventos"
  ON public.eventos_viaje FOR SELECT TO authenticated
  USING (chofer_id = auth.uid());

CREATE POLICY "Admin ve todos los eventos"
  ON public.eventos_viaje FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for viaje-eventos bucket
CREATE POLICY "Chofer sube fotos de viaje"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'viaje-eventos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Chofer lee sus fotos de viaje"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'viaje-eventos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admin lee fotos de viaje"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'viaje-eventos'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
