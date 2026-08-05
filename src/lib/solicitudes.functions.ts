import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Sb = { from: (t: string) => any };

async function getRoles(supabase: Sb, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: string }[]).map((r) => r.role);
}

const ADMINISH = ["admin", "lider_cuenta"];
const COMERCIALISH = ["admin", "lider_cuenta", "comercial"];

/** Toma la solicitud para sí mismo y la normaliza a estado `nueva`. */
export const asignarmeSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase as unknown as Sb, userId);
    if (!COMERCIALISH.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { error } = await supabase
      .from("cotizaciones")
      .update({ asignado_a: userId, estado: "nueva" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, asignado_a: userId };
  });

/** Reasigna la solicitud a otro usuario del equipo comercial. */
export const reasignarSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase as unknown as Sb, userId);
    if (!ADMINISH.some((r) => roles.includes(r))) throw new Error("Solo admin o líder de cuenta.");

    const { error } = await supabase
      .from("cotizaciones")
      .update({ asignado_a: data.user_id, estado: "nueva" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pasa la solicitud al pipeline como cotizada. */
export const convertirEnCotizacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase as unknown as Sb, userId);
    if (!COMERCIALISH.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { error } = await supabase
      .from("cotizaciones")
      .update({ estado: "cotizada" } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Descarta la solicitud entrante. */
export const descartarSolicitud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase as unknown as Sb, userId);
    if (!ADMINISH.some((r) => roles.includes(r))) throw new Error("Solo admin o líder de cuenta.");

    const { error } = await supabase
      .from("cotizaciones")
      .update({
        estado: "rechazada",
        comentarios_rechazo: "Descartada desde solicitudes entrantes",
        rechazada_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type StaffOption = { id: string; nombre: string; roles: string[] };

/** Lista usuarios asignables (comercial / líder de cuenta) con su nombre. */
export const listarAsignables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffOption[]> => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase as unknown as Sb, userId);
    if (!ADMINISH.some((r) => roles.includes(r))) throw new Error("Solo admin o líder de cuenta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["comercial", "lider_cuenta"]);

    const byUser = new Map<string, string[]>();
    for (const r of (roleRows ?? []) as { user_id: string; role: string }[]) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role]);
    }
    if (byUser.size === 0) return [];

    const ids = [...byUser.keys()];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, razon_social, correo")
      .in("id", ids);
    const nameById = new Map(
      ((profiles ?? []) as { id: string; razon_social: string | null; correo: string | null }[]).map(
        (p) => [p.id, p.razon_social || p.correo || ""],
      ),
    );

    const out: StaffOption[] = [];
    for (const id of ids) {
      let nombre = nameById.get(id) ?? "";
      if (!nombre) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(id);
        nombre = data?.user?.email ?? id.slice(0, 8);
      }
      out.push({ id, nombre, roles: byUser.get(id) ?? [] });
    }
    return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

/** Nombres de los asignados actuales, para mostrar en las tarjetas. */
export const nombresAsignados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<Record<string, string>> => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase as unknown as Sb, userId);
    if (!COMERCIALISH.some((r) => roles.includes(r))) throw new Error("Sin permisos.");
    if (data.ids.length === 0) return {};

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, razon_social, correo")
      .in("id", data.ids);

    const map: Record<string, string> = {};
    for (const p of (profiles ?? []) as {
      id: string;
      razon_social: string | null;
      correo: string | null;
    }[]) {
      map[p.id] = p.razon_social || p.correo || "";
    }
    for (const id of data.ids) {
      if (!map[id]) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        map[id] = u?.user?.email ?? id.slice(0, 8);
      }
    }
    return map;
  });
