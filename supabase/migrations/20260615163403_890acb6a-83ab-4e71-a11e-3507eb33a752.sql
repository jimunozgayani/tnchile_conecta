
-- 1. user_roles: admin-only write policies
CREATE POLICY "admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. is_suspended helper
CREATE OR REPLACE FUNCTION public.is_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.supplier_invitations si
    JOIN auth.users u ON lower(u.email) = lower(si.email)
    WHERE u.id = _user_id AND si.status = 'suspended'
  )
$$;

-- 3. Re-create write policies on supplier tables incorporating suspension check
DROP POLICY "own trucks insert" ON public.trucks;
DROP POLICY "own trucks update" ON public.trucks;
DROP POLICY "own trucks delete" ON public.trucks;
CREATE POLICY "own trucks insert" ON public.trucks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own trucks update" ON public.trucks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own trucks delete" ON public.trucks FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY "own drivers insert" ON public.drivers;
DROP POLICY "own drivers update" ON public.drivers;
DROP POLICY "own drivers delete" ON public.drivers;
CREATE POLICY "own drivers insert" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own drivers update" ON public.drivers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own drivers delete" ON public.drivers FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY "own docs insert" ON public.documents;
DROP POLICY "own docs update" ON public.documents;
DROP POLICY "own docs delete" ON public.documents;
CREATE POLICY "own docs insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own docs update" ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own docs delete" ON public.documents FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY "own tarifas insert" ON public.tarifas;
DROP POLICY "own tarifas update" ON public.tarifas;
DROP POLICY "own tarifas delete" ON public.tarifas;
CREATE POLICY "own tarifas insert" ON public.tarifas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own tarifas update" ON public.tarifas FOR UPDATE TO authenticated
  USING (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()))
  WITH CHECK (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()));
CREATE POLICY "own tarifas delete" ON public.tarifas FOR DELETE TO authenticated
  USING (auth.uid() = proveedor_id AND NOT public.is_suspended(auth.uid()));

DROP POLICY "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT public.is_suspended(auth.uid()))
  WITH CHECK (auth.uid() = id AND NOT public.is_suspended(auth.uid()));

-- 4. Mensajes: restrict recipient UPDATE to only `leido` column changes via trigger
CREATE OR REPLACE FUNCTION public.mensajes_restrict_recipient_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Admins (sender side) can update freely
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- Recipients may only toggle `leido`
  IF NEW.contenido IS DISTINCT FROM OLD.contenido
     OR NEW.asunto IS DISTINCT FROM OLD.asunto
     OR NEW.de_usuario_id IS DISTINCT FROM OLD.de_usuario_id
     OR NEW.para_proveedor_id IS DISTINCT FROM OLD.para_proveedor_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the leido field may be modified by recipients' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mensajes_restrict_recipient_update_trg ON public.mensajes;
CREATE TRIGGER mensajes_restrict_recipient_update_trg
  BEFORE UPDATE ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION public.mensajes_restrict_recipient_update();

-- Audit trail for mensajes
DROP TRIGGER IF EXISTS mensajes_audit_trg ON public.mensajes;
CREATE TRIGGER mensajes_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION public.write_audit_log();

-- 5. handle_new_user: require invitation; remove hardcoded admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv public.supplier_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.supplier_invitations
   WHERE lower(email) = lower(NEW.email) LIMIT 1;

  INSERT INTO public.profiles (id, correo, razon_social, rut_empresa)
  VALUES (NEW.id, NEW.email, inv.company_name, inv.rut);

  -- Only assign supplier role if a non-suspended invitation exists
  IF inv.id IS NOT NULL AND COALESCE(inv.status, 'invited') <> 'suspended' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'supplier') ON CONFLICT DO NOTHING;

    UPDATE public.supplier_invitations
      SET status = 'active', activated_at = now(), user_id = NEW.id, updated_at = now()
      WHERE id = inv.id;
  END IF;

  RETURN NEW;
END;
$$;
