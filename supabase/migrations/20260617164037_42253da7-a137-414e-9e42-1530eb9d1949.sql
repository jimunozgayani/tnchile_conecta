-- Fix Data API: grant required privileges on all public tables.
-- RLS policies remain the actual access control; grants only allow PostgREST to reach the tables.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trucks TO authenticated;
GRANT ALL ON public.trucks TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarifas TO authenticated;
GRANT ALL ON public.tarifas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rates TO authenticated;
GRANT ALL ON public.rates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asignaciones TO authenticated;
GRANT ALL ON public.asignaciones TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensajes TO authenticated;
GRANT ALL ON public.mensajes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificaciones TO authenticated;
GRANT ALL ON public.notificaciones TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_invitations TO authenticated;
GRANT ALL ON public.supplier_invitations TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

GRANT SELECT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;