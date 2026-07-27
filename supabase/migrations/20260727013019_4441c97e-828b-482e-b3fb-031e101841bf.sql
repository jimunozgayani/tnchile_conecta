-- 1) Operador: limitar visibilidad de perfiles de chofer (RUT/licencia) a los aprobados.
DROP POLICY IF EXISTS "operador ve chofer_perfiles" ON public.chofer_perfiles;
CREATE POLICY "operador ve chofer_perfiles aprobados"
  ON public.chofer_perfiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'operador'::app_role)
    AND estado_validacion = 'aprobado'
  );

-- 2) Ciudades: catálogo interno, requiere sesión iniciada.
DROP POLICY IF EXISTS "Cualquiera puede leer ciudades" ON public.ciudades_chile;
DROP POLICY IF EXISTS "cualquiera lee ciudades" ON public.ciudades_chile;
DROP POLICY IF EXISTS "public read ciudades_chile" ON public.ciudades_chile;
DROP POLICY IF EXISTS "Ciudades son publicas" ON public.ciudades_chile;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'ciudades_chile'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.ciudades_chile', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "usuarios autenticados leen ciudades"
  ON public.ciudades_chile
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT ON public.ciudades_chile FROM anon;