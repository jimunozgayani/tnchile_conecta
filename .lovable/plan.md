## Problema detectado

Ninguna tabla del esquema `public` tiene permisos (`GRANT`) otorgados a los roles `authenticated`, `anon` o `service_role`. Por eso la Data API (PostgREST) responde "permission denied" y la app no muestra **camiones, choferes ni proveedores** — ni como admin ni como proveedor — aunque las políticas RLS están bien definidas y hay datos en la base (2 camiones, 5 perfiles).

Esto suele pasar tras un remix o cuando se crearon tablas sin el bloque `GRANT` obligatorio. Las políticas RLS por sí solas no bastan: Supabase requiere `GRANT` explícitos.

## Solución (una sola migración)

Otorgar permisos a las 13 tablas de `public` siguiendo estas reglas:

- **`service_role`** → `ALL` en todas (necesario para edge/admin code).
- **`authenticated`** → `SELECT, INSERT, UPDATE, DELETE` en todas las tablas con políticas para usuarios logueados.
- **`anon`** → **ninguno**. Todas las políticas se basan en `auth.uid()` o `has_role`, así que no debe haber acceso anónimo.

Tablas cubiertas:
`profiles`, `trucks`, `drivers`, `documents`, `tarifas`, `rates`, `asignaciones`, `mensajes`, `notificaciones`, `supplier_invitations`, `user_roles`, `login_attempts`, `audit_log`.

Notas:
- `user_roles`: ya restringe escritura por política a admins, así que dar `INSERT/UPDATE/DELETE` a `authenticated` es seguro (RLS bloquea a no-admins).
- `audit_log` / `login_attempts`: solo `SELECT` para `authenticated` (la escritura la hacen triggers como `service_role`).

## Verificación post-fix

1. Recargar `/admin` → deben aparecer proveedores y stats.
2. Entrar como proveedor → `/camiones`, `/choferes`, `/perfil` deben listar datos.
3. Confirmar consola del navegador sin errores `permission denied`.

No hay cambios de código frontend — el bug es 100% de permisos de base de datos.