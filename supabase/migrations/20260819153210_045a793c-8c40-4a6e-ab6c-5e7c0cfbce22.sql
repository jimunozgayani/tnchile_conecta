-- Ensure banking columns stay unreadable for all API roles (idempotent re-assert)
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.contactos FROM authenticated, anon;
REVOKE SELECT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.pagos_proveedor FROM authenticated, anon;

-- pagos_proveedor banking columns are written only by privileged server code (service_role),
-- so remove write access from API roles as well.
REVOKE INSERT (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.pagos_proveedor FROM authenticated, anon;
REVOKE UPDATE (banco, tipo_cuenta, numero_cuenta, email_banco) ON public.pagos_proveedor FROM authenticated, anon;

GRANT ALL ON public.contactos TO service_role;
GRANT ALL ON public.pagos_proveedor TO service_role;