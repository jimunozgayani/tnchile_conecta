
-- Lock down SECURITY DEFINER functions: revoke broad EXECUTE, grant only where required.

-- Trigger functions: only the table owner / postgres invokes them. No client EXECUTE needed.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mensajes_restrict_recipient_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tarifas_set_updated_at() FROM PUBLIC, anon, authenticated;

-- Maintenance/cron function: not for client use.
REVOKE ALL ON FUNCTION public.process_document_expiries() FROM PUBLIC, anon, authenticated;

-- Admin RPC: only signed-in users (function itself enforces admin role).
REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- RLS helper functions: must remain executable for policies evaluated as caller.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;

-- is_email_locked is invoked from the login flow (anon needs it before sign-in).
REVOKE ALL ON FUNCTION public.is_email_locked(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_email_locked(text) TO anon, authenticated;
