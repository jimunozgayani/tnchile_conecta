
CREATE TYPE public.invitation_status AS ENUM ('invited', 'active');

CREATE TABLE public.supplier_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  company_name TEXT,
  rut TEXT,
  status public.invitation_status NOT NULL DEFAULT 'invited',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  invited_by UUID,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invitations TO authenticated;
GRANT ALL ON public.supplier_invitations TO service_role;

ALTER TABLE public.supplier_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins view invitations" ON public.supplier_invitations
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert invitations" ON public.supplier_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update invitations" ON public.supplier_invitations
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete invitations" ON public.supplier_invitations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Extend handle_new_user to mark invitation active and prefill profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv public.supplier_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM public.supplier_invitations WHERE lower(email) = lower(NEW.email) LIMIT 1;

  INSERT INTO public.profiles (id, correo, razon_social, rut_empresa)
  VALUES (NEW.id, NEW.email, inv.company_name, inv.rut);

  IF NEW.email = 'admin@tnchile.cl' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'supplier') ON CONFLICT DO NOTHING;
  END IF;

  IF inv.id IS NOT NULL THEN
    UPDATE public.supplier_invitations
    SET status = 'active', activated_at = now(), user_id = NEW.id, updated_at = now()
    WHERE id = inv.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
