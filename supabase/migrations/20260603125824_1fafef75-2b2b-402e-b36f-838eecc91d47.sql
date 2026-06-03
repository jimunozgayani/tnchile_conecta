
CREATE TABLE public.mensajes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  de_usuario_id UUID NOT NULL,
  para_proveedor_id UUID NOT NULL,
  asunto TEXT NOT NULL,
  contenido TEXT NOT NULL,
  leido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensajes TO authenticated;
GRANT ALL ON public.mensajes TO service_role;

ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins insert mensajes"
  ON public.mensajes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND de_usuario_id = auth.uid());

CREATE POLICY "admins read all mensajes"
  ON public.mensajes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "recipients read own mensajes"
  ON public.mensajes FOR SELECT TO authenticated
  USING (para_proveedor_id = auth.uid());

CREATE POLICY "recipients mark own read"
  ON public.mensajes FOR UPDATE TO authenticated
  USING (para_proveedor_id = auth.uid())
  WITH CHECK (para_proveedor_id = auth.uid());

CREATE INDEX idx_mensajes_para ON public.mensajes(para_proveedor_id, created_at DESC);
CREATE INDEX idx_mensajes_de ON public.mensajes(de_usuario_id, created_at DESC);
