import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";

const CERRADAS = ["cerrada", "rechazada"];
const NUEVAS = ["nueva", "pendiente"];
const OPS_ACTIVAS = ["lista_para_operar", "confirmada", "en_operacion"];

export type MiembroComercial = {
  user_id: string;
  nombre: string;
  operaciones_abiertas: number;
  cerradas_mes: number;
  sin_asignar: number;
};

export type MiembroOperaciones = {
  user_id: string;
  nombre: string;
  operaciones_activas: number;
  finalizadas_mes: number;
};

export type Meta = {
  id: string;
  rol: string;
  user_id: string | null;
  periodo: string;
  descripcion: string;
  valor_objetivo: number | null;
  valor_actual: number | null;
  unidad: string | null;
};

export type ActividadEquipo = {
  id: string;
  accion: string;
  usuario_email: string | null;
  created_at: string;
};

function inicioDeMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function nombresDe(userIds: string[]): Promise<Record<string, string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const out: Record<string, string> = {};
  if (userIds.length === 0) return out;

  const { data: profs } = await supabaseAdmin
    .from("profiles")
    .select("id, nombre_contacto, correo")
    .in("id", userIds);

  for (const p of (profs ?? []) as { id: string; nombre_contacto: string | null; correo: string | null }[]) {
    out[p.id] = p.nombre_contacto?.trim() || p.correo?.trim() || "";
  }

  for (const id of userIds) {
    if (!out[id]) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      out[id] = data?.user?.email ?? "Usuario sin nombre";
    }
  }
  return out;
}

async function equipoDe(rol: string): Promise<{ user_id: string; nombre: string }[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", rol as never);
  if (error) throw new Error(error.message);
  const ids = Array.from(new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id)));
  const nombres = await nombresDe(ids);
  return ids
    .map((id) => ({ user_id: id, nombre: nombres[id] ?? "Usuario" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

async function assertRoles(supabase: unknown, userId: string, permitidos: string[]) {
  const roles = await rolesDe(supabase as never, userId);
  if (!permitidos.some((r) => roles.includes(r))) throw new Error("Sin permisos.");
  return roles;
}

/** Equipo comercial con métricas por ejecutivo. Solo admin / líder de cuenta. */
export const obtenerEquipoComercial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MiembroComercial[]> => {
    await assertRoles(context.supabase, context.userId, ["admin", "lider_cuenta"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const equipo = await equipoDe("comercial");
    const mes = inicioDeMes();

    const { count: sinAsignar } = await supabaseAdmin
      .from("cotizaciones")
      .select("id", { count: "exact", head: true })
      .is("asignado_a", null)
      .in("estado", NUEVAS);

    const filas: MiembroComercial[] = [];
    for (const m of equipo) {
      const [abiertas, cerradas] = await Promise.all([
        supabaseAdmin
          .from("cotizaciones")
          .select("id", { count: "exact", head: true })
          .eq("asignado_a", m.user_id)
          .not("estado", "in", `(${CERRADAS.join(",")})`),
        supabaseAdmin
          .from("cotizaciones")
          .select("id", { count: "exact", head: true })
          .eq("asignado_a", m.user_id)
          .eq("estado", "cerrada")
          .gte("fecha_despacho", mes),
      ]);
      filas.push({
        user_id: m.user_id,
        nombre: m.nombre,
        operaciones_abiertas: abiertas.count ?? 0,
        cerradas_mes: cerradas.count ?? 0,
        sin_asignar: sinAsignar ?? 0,
      });
    }
    return filas;
  });

/** Equipo de operaciones con métricas por operador. Solo admin / jefe de operaciones. */
export const obtenerEquipoOperaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MiembroOperaciones[]> => {
    await assertRoles(context.supabase, context.userId, ["admin", "jefe_operaciones"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const equipo = await equipoDe("operador");
    const mes = inicioDeMes();

    const filas: MiembroOperaciones[] = [];
    for (const m of equipo) {
      const [activas, finalizadas] = await Promise.all([
        supabaseAdmin
          .from("operaciones")
          .select("id", { count: "exact", head: true })
          .eq("creado_por", m.user_id)
          .is("deleted_at", null)
          .in("estado", OPS_ACTIVAS),
        supabaseAdmin
          .from("operaciones")
          .select("id", { count: "exact", head: true })
          .eq("finalizada_por", m.user_id)
          .is("deleted_at", null)
          .gte("finalizada_at", `${mes}T00:00:00Z`),
      ]);
      filas.push({
        user_id: m.user_id,
        nombre: m.nombre,
        operaciones_activas: activas.count ?? 0,
        finalizadas_mes: finalizadas.count ?? 0,
      });
    }
    return filas;
  });

/** Últimos movimientos del equipo en la tabla operaciones. */
export const obtenerActividadOperaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActividadEquipo[]> => {
    await assertRoles(context.supabase, context.userId, ["admin", "jefe_operaciones"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("audit_log")
      .select("id, accion, usuario_email, created_at")
      .eq("tabla_nombre", "operaciones")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw new Error(error.message);
    return (data ?? []) as ActividadEquipo[];
  });

const ROL_POR_LIDER: Record<string, string> = {
  lider_cuenta: "comercial",
  jefe_operaciones: "operador",
};

/** Crea una meta del período para el equipo del líder. */
export const crearMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rol: z.enum(["comercial", "operador"]),
        periodo: z.string().regex(/^\d{4}-\d{2}$/),
        descripcion: z.string().trim().min(3).max(300),
        valor_objetivo: z.number().positive(),
        unidad: z.enum(["operaciones", "CLP", "%"]),
        user_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Meta> => {
    const roles = await assertRoles(context.supabase, context.userId, [
      "admin",
      "lider_cuenta",
      "jefe_operaciones",
    ]);
    if (!roles.includes("admin")) {
      const permitido = roles.some((r) => ROL_POR_LIDER[r] === data.rol);
      if (!permitido) throw new Error("Solo puedes definir metas de tu propio equipo.");
    }
    // Los líderes (lider_cuenta / jefe_operaciones) no pueden auto-asignarse metas
    // individuales: solo un administrador puede asignar metas individuales a un líder.
    if (
      data.user_id &&
      data.user_id === context.userId &&
      !roles.includes("admin")
    ) {
      throw new Error("Solo un administrador puede asignarte metas individuales.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: meta, error } = await supabaseAdmin
      .from("metas")
      .insert({
        rol: data.rol,
        periodo: data.periodo,
        descripcion: data.descripcion,
        valor_objetivo: data.valor_objetivo,
        unidad: data.unidad,
        user_id: data.user_id ?? null,
        creado_por: context.userId,
      } as never)
      .select("id, rol, user_id, periodo, descripcion, valor_objetivo, valor_actual, unidad")
      .single();
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "metas",
      registro_id: (meta as { id: string }).id,
      accion: "INSERT",
      datos_nuevos: meta as never,
      usuario_id: context.userId,
    } as never);

    return meta as Meta;
  });

/** Metas de un rol y período. Cualquier rol interno (RLS acota la lectura). */
export const obtenerMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rol: z.enum(["comercial", "operador"]),
        periodo: z.string().regex(/^\d{4}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<Meta[]> => {
    await assertRoles(context.supabase, context.userId, [
      "admin",
      "lider_cuenta",
      "jefe_operaciones",
      "comercial",
      "operador",
    ]);
    const { data: metas, error } = await context.supabase
      .from("metas")
      .select("id, rol, user_id, periodo, descripcion, valor_objetivo, valor_actual, unidad")
      .eq("rol", data.rol)
      .eq("periodo", data.periodo)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (metas ?? []) as Meta[];
  });
