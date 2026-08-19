import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdminEntidad, AdminFila, StaffOpcion } from "@/lib/admin-super";

const entidad = z.enum(["usuario", "proveedor", "cliente", "chofer", "carga", "operacion"]);

export const listarAdminEntidad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        tipo: entidad,
        q: z.string().max(120).optional(),
        incluirEliminados: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<AdminFila[]> => {
    const { assertAdmin, listar } = await import("@/lib/admin-super.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return listar(supabaseAdmin, data.tipo as AdminEntidad, data.q ?? "", data.incluirEliminados ?? false);
  });

export const eliminarAdminEntidad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ tipo: entidad, id: z.string().uuid(), modo: z.enum(["logico", "definitivo"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, eliminar } = await import("@/lib/admin-super.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return eliminar(supabaseAdmin, data.tipo as AdminEntidad, data.id, data.modo, context.userId);
  });

export const restaurarAdminEntidad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tipo: entidad, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertAdmin, restaurar } = await import("@/lib/admin-super.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return restaurar(supabaseAdmin, data.tipo as AdminEntidad, data.id, context.userId);
  });

export const reasignarCarga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ cotizacion_id: z.string().uuid(), user_id: z.string().uuid().nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, reasignarCargaImpl } = await import("@/lib/admin-super.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return reasignarCargaImpl(supabaseAdmin, data.cotizacion_id, data.user_id, context.userId);
  });

export const reasignarOperacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ operacion_id: z.string().uuid(), user_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, reasignarOperacionImpl } = await import("@/lib/admin-super.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return reasignarOperacionImpl(supabaseAdmin, data.operacion_id, data.user_id, context.userId);
  });

export const listarStaffAsignable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffOpcion[]> => {
    const { assertAdmin, listarStaffImpl } = await import("@/lib/admin-super.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return listarStaffImpl(supabaseAdmin);
  });
