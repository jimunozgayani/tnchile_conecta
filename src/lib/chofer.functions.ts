import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listSuppliersForChofer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Suppliers = users with 'supplier' role
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "supplier");
    if (rolesErr) throw new Error(rolesErr.message);
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [] as { id: string; razon_social: string | null }[];
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, razon_social")
      .in("id", ids)
      .is("deleted_at", null)
      .order("razon_social", { ascending: true });
    if (error) throw new Error(error.message);
    return (profiles ?? []) as { id: string; razon_social: string | null }[];
  });

const EditInput = z.object({
  driver_id: z.string().uuid(),
  nombre_completo: z.string().min(1),
  celular: z.string().nullable().optional(),
  clase_licencia: z.string().nullable().optional(),
  camion_asignado_id: z.string().uuid().nullable().optional(),
});

/** operador / jefe_operaciones / admin can manage occasional drivers. */
async function assertGestor(context: any) {
  const roles = ["operador", "jefe_operaciones", "admin"];
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some((r: any) => roles.includes(r.role));
  if (!ok) throw new Error("No autorizado para gestionar choferes ocasionales.");
}

/** Only rows with origen_registro = 'operaciones' may be touched here. */
async function assertOcasional(admin: any, driverId: string) {
  const { data, error } = await admin
    .from("drivers")
    .select("id, origen_registro, nombre_completo")
    .eq("id", driverId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Chofer no encontrado.");
  if (data.origen_registro !== "operaciones")
    throw new Error("Solo se pueden editar choferes ocasionales.");
  return data;
}

export const editarChoferOcasional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EditInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertGestor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertOcasional(supabaseAdmin, data.driver_id);
    // The drivers audit trigger records the before/after snapshot in audit_log.
    const { error } = await supabaseAdmin
      .from("drivers")
      .update({
        nombre_completo: data.nombre_completo,
        celular: data.celular ?? null,
        clase_licencia: data.clase_licencia ?? null,
        camion_asignado_id: data.camion_asignado_id ?? null,
      })
      .eq("id", data.driver_id)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const eliminarChoferOcasional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ driver_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertGestor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertOcasional(supabaseAdmin, data.driver_id);
    const { error } = await supabaseAdmin
      .from("drivers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.driver_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
