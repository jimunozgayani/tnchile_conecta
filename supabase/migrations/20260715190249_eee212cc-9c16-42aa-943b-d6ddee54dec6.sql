
CREATE TABLE public.cotizaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contacto_nombre TEXT NOT NULL,
  contacto_telefono TEXT,
  contacto_email TEXT,
  origen TEXT NOT NULL,
  destinos JSONB NOT NULL DEFAULT '[]'::jsonb,
  tipo_camion TEXT,
  modalidad TEXT NOT NULL DEFAULT 'completo' CHECK (modalidad IN ('completo','consolidado')),
  peso_kg NUMERIC,
  largo_cm NUMERIC,
  ancho_cm NUMERIC,
  alto_cm NUMERIC,
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb,
  fecha_despacho DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_revision','cotizada','aceptada','rechazada','cancelada')),
  notas_admin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizaciones TO authenticated;
GRANT ALL ON public.cotizaciones TO service_role;

ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes ven sus cotizaciones"
  ON public.cotizaciones FOR SELECT TO authenticated
  USING (cliente_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "clientes crean sus cotizaciones"
  ON public.cotizaciones FOR INSERT TO authenticated
  WITH CHECK (cliente_id = auth.uid());

CREATE POLICY "cliente edita pendientes, admin todo"
  ON public.cotizaciones FOR UPDATE TO authenticated
  USING (
    (cliente_id = auth.uid() AND estado = 'pendiente')
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (cliente_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "admin borra cotizaciones"
  ON public.cotizaciones FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER cotizaciones_set_updated_at
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.tarifas_set_updated_at();

CREATE INDEX cotizaciones_cliente_idx ON public.cotizaciones(cliente_id, created_at DESC);
CREATE INDEX cotizaciones_estado_idx ON public.cotizaciones(estado, created_at DESC);

-- Storage policies: cotizacion-fotos bucket, files under {user_id}/...
CREATE POLICY "cot fotos: cliente sube en su carpeta"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'cotizacion-fotos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "cot fotos: cliente ve sus fotos, admin ve todas"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'cotizacion-fotos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "cot fotos: cliente borra las suyas, admin todas"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'cotizacion-fotos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin')
    )
  );
