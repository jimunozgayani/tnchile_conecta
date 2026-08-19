/**
 * Poderes plenipotenciarios del administrador.
 *
 * Lógica server-only compartida por src/lib/admin-super.functions.ts:
 * listar, eliminar (lógico o definitivo), restaurar y reasignar cualquier
 * registro operativo o comercial del sistema.
 */

export type AdminEntidad =
  | "usuario"
  | "proveedor"
  | "cliente"
  | "chofer"
  | "carga"
  | "operacion";

export type AdminFila = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  detalle: string | null;
  eliminado: boolean;
  extra: Record<string, string | number | boolean | null>;
};

export const ENTIDAD_LABEL: Record<AdminEntidad, string> = {
  usuario: "Usuarios",
  proveedor: "Proveedores",
  cliente: "Clientes y contactos",
  chofer: "Choferes",
  carga: "Cargas (cotizaciones)",
  operacion: "Operaciones",
};

/** Tablas con borrado lógico (columna deleted_at). */
const TABLA_POR_ENTIDAD: Record<Exclude<AdminEntidad, "usuario">, string> = {
  proveedor: "profiles",
  cliente: "contactos",
  chofer: "drivers",
  carga: "cotizaciones",
  operacion: "operaciones",
};

export async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Solo administradores pueden ejecutar esta acción.");
  }
}

function match(q: string, ...campos: (string | null | undefined)[]) {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return campos.some((c) => (c ?? "").toLowerCase().includes(needle));
}

export async function listar(
  admin: any,
  tipo: AdminEntidad,
  q: string,
  incluirEliminados: boolean,
): Promise<AdminFila[]> {
  if (tipo === "usuario") {
    const users: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      users.push(...(data?.users ?? []));
      if ((data?.users?.length ?? 0) < 200) break;
    }
    const { data: roleRows } = await admin.from("user_roles").select("user_id, role");
    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as string);
      rolesByUser.set(r.user_id, list);
    }
    return users
      .filter((u) => match(q, u.email))
      .map((u) => ({
        id: u.id as string,
        titulo: (u.email ?? "(sin correo)") as string,
        subtitulo: (rolesByUser.get(u.id) ?? []).join(", ") || "sin roles",
        detalle: u.last_sign_in_at ? `Último ingreso: ${u.last_sign_in_at}` : "Nunca ingresó",
        eliminado: false,
        extra: { roles: (rolesByUser.get(u.id) ?? []).join(",") },
      }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo));
  }

  const tabla = TABLA_POR_ENTIDAD[tipo];
  const select =
    tipo === "proveedor"
      ? "id, razon_social, correo, rut_empresa, deleted_at"
      : tipo === "cliente"
        ? "id, nombre, empresa, email, telefono, tipos, deleted_at"
        : tipo === "chofer"
          ? "id, nombre_completo, rut, celular, email, deleted_at"
          : tipo === "carga"
            ? "id, contacto_nombre, origen, estado, fecha_despacho, asignado_a, created_at, deleted_at"
            : "id, numero_operacion, estado, origen, destino, fecha_carga, deleted_at";

  let query = admin.from(tabla).select(select).limit(500);
  if (!incluirEliminados) query = query.is("deleted_at", null);
  query =
    tipo === "operacion"
      ? query.order("numero_operacion", { ascending: false })
      : tipo === "carga"
        ? query.order("created_at", { ascending: false })
        : query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, any>[];
  return rows
    .filter((r) =>
      match(
        q,
        r["razon_social"],
        r["correo"],
        r["rut_empresa"],
        r["nombre"],
        r["empresa"],
        r["email"],
        r["nombre_completo"],
        r["rut"],
        r["contacto_nombre"],
        r["origen"],
        r["destino"],
        r["estado"],
        r["numero_operacion"] != null ? String(r["numero_operacion"]) : null,
      ),
    )
    .map((r): AdminFila => {
      const eliminado = Boolean(r["deleted_at"]);
      if (tipo === "proveedor") {
        return {
          id: r["id"],
          titulo: r["razon_social"] ?? r["correo"] ?? "(sin nombre)",
          subtitulo: r["correo"] ?? null,
          detalle: r["rut_empresa"] ?? null,
          eliminado,
          extra: {},
        };
      }
      if (tipo === "cliente") {
        return {
          id: r["id"],
          titulo: r["nombre"] ?? "(sin nombre)",
          subtitulo: r["empresa"] ?? r["email"] ?? null,
          detalle: [(r["tipos"] ?? []).join(", "), r["telefono"]].filter(Boolean).join(" · ") || null,
          eliminado,
          extra: {},
        };
      }
      if (tipo === "chofer") {
        return {
          id: r["id"],
          titulo: r["nombre_completo"] ?? "(sin nombre)",
          subtitulo: r["rut"] ?? null,
          detalle: [r["celular"], r["email"]].filter(Boolean).join(" · ") || null,
          eliminado,
          extra: {},
        };
      }
      if (tipo === "carga") {
        return {
          id: r["id"],
          titulo: r["contacto_nombre"] ?? "(sin contacto)",
          subtitulo: r["origen"] ?? null,
          detalle: [r["estado"], r["fecha_despacho"]].filter(Boolean).join(" · ") || null,
          eliminado,
          extra: { asignado_a: r["asignado_a"] ?? null, estado: r["estado"] },
        };
      }
      return {
        id: r["id"],
        titulo: `Operación N°${r["numero_operacion"]}`,
        subtitulo: [r["origen"], r["destino"]].filter(Boolean).join(" → ") || null,
        detalle: [r["estado"], r["fecha_carga"]].filter(Boolean).join(" · ") || null,
        eliminado,
        extra: { estado: r["estado"] },
      };
    });
}

async function auditar(
  admin: any,
  tabla: string,
  registroId: string,
  accion: string,
  datos: Record<string, unknown>,
  userId: string,
) {
  await admin.from("audit_log").insert({
    tabla_nombre: tabla,
    registro_id: registroId,
    accion,
    datos_nuevos: datos as never,
    usuario_id: userId,
  } as never);
}

export async function eliminar(
  admin: any,
  tipo: AdminEntidad,
  id: string,
  modo: "logico" | "definitivo",
  adminUserId: string,
) {
  if (tipo === "usuario") {
    if (id === adminUserId) throw new Error("No puedes eliminar tu propia cuenta.");
    if (modo === "logico") {
      // Sin acceso: se revocan todos los roles y se marca el perfil como eliminado.
      await admin.from("user_roles").delete().eq("user_id", id);
      await admin.from("profiles").update({ deleted_at: new Date().toISOString() } as never).eq("id", id);
      await auditar(admin, "auth.users", id, "admin_desactiva_usuario", { modo }, adminUserId);
      return { ok: true, mensaje: "Cuenta desactivada: se revocaron todos sus roles." };
    }
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    await auditar(admin, "auth.users", id, "admin_elimina_usuario", { modo }, adminUserId);
    return { ok: true, mensaje: "Cuenta eliminada definitivamente." };
  }

  const tabla = TABLA_POR_ENTIDAD[tipo];

  if (modo === "logico") {
    const patch: Record<string, unknown> = { deleted_at: new Date().toISOString() };
    // Las cargas se sacan además de todos los tableros cambiando su estado.
    if (tipo === "carga") patch["estado"] = "eliminada";
    const { error } = await admin.from(tabla).update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    await auditar(admin, tabla, id, "admin_elimina_logico", patch, adminUserId);
    return { ok: true, mensaje: "Registro eliminado (se puede restaurar)." };
  }

  const { error } = await admin.from(tabla).delete().eq("id", id);
  if (error) {
    throw new Error(
      `No se puede borrar definitivamente porque hay registros relacionados (${error.message}). Usa el borrado lógico.`,
    );
  }
  await auditar(admin, tabla, id, "admin_elimina_definitivo", { modo }, adminUserId);
  return { ok: true, mensaje: "Registro eliminado definitivamente." };
}

export async function restaurar(admin: any, tipo: AdminEntidad, id: string, adminUserId: string) {
  if (tipo === "usuario") {
    const { error } = await admin
      .from("profiles")
      .update({ deleted_at: null } as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    await auditar(admin, "auth.users", id, "admin_restaura_usuario", {}, adminUserId);
    return { ok: true, mensaje: "Cuenta reactivada. Recuerda volver a asignarle sus roles." };
  }
  const tabla = TABLA_POR_ENTIDAD[tipo];
  const patch: Record<string, unknown> = { deleted_at: null };
  if (tipo === "carga") patch["estado"] = "nueva";
  const { error } = await admin.from(tabla).update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
  await auditar(admin, tabla, id, "admin_restaura", patch, adminUserId);
  return { ok: true, mensaje: "Registro restaurado." };
}

/** Reasigna una carga a otro ejecutivo comercial (o la deja sin responsable). */
export async function reasignarCargaImpl(
  admin: any,
  cotizacionId: string,
  userId: string | null,
  adminUserId: string,
) {
  const { error } = await admin
    .from("cotizaciones")
    .update({ asignado_a: userId } as never)
    .eq("id", cotizacionId);
  if (error) throw new Error(error.message);
  await auditar(
    admin,
    "cotizaciones",
    cotizacionId,
    "admin_reasigna_carga",
    { asignado_a: userId },
    adminUserId,
  );
  return { ok: true };
}

/**
 * Reasigna una operación a otro operador. La atribución de operaciones se
 * calcula desde la propuesta ganadora (operador_id) y desde quien creó la
 * asignación, así que se actualizan ambas.
 */
export async function reasignarOperacionImpl(
  admin: any,
  operacionId: string,
  userId: string,
  adminUserId: string,
) {
  const { data: op, error } = await admin
    .from("operaciones")
    .select("id, cotizacion_id, asignacion_id")
    .eq("id", operacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!op) throw new Error("Operación no encontrada.");

  if (op["cotizacion_id"]) {
    const { data: cot } = await admin
      .from("cotizaciones")
      .select("propuesta_ganadora_id")
      .eq("id", op["cotizacion_id"])
      .maybeSingle();
    const propId = cot?.["propuesta_ganadora_id"];
    if (propId) {
      await admin
        .from("propuestas_proveedor")
        .update({ operador_id: userId } as never)
        .eq("id", propId);
    }
  }
  if (op["asignacion_id"]) {
    await admin
      .from("asignaciones")
      .update({ creado_por: userId } as never)
      .eq("id", op["asignacion_id"]);
  }

  await auditar(
    admin,
    "operaciones",
    operacionId,
    "admin_reasigna_operacion",
    { operador_id: userId },
    adminUserId,
  );
  return { ok: true };
}

export type StaffOpcion = { id: string; email: string; roles: string[] };

/** Usuarios internos disponibles para reasignaciones. */
export async function listarStaffImpl(admin: any): Promise<StaffOpcion[]> {
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "comercial", "lider_cuenta", "operador", "jefe_operaciones"]);

  const byUser = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r.role as string);
    byUser.set(r.user_id, list);
  }
  if (byUser.size === 0) return [];

  const users: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    users.push(...(data?.users ?? []));
    if ((data?.users?.length ?? 0) < 200) break;
  }

  return users
    .filter((u) => byUser.has(u.id))
    .map((u) => ({ id: u.id as string, email: (u.email ?? u.id) as string, roles: byUser.get(u.id)! }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
