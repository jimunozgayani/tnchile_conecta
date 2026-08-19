import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";

/**
 * Genera (o reutiliza) el PDF de asignación de una operación y devuelve una URL
 * firmada. Se puede pedir por id de operación (Operaciones) o por id de
 * cotización (Comercial).
 */
export const generarAsignacionPDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        operacion_id: z.string().uuid().optional(),
        cotizacion_id: z.string().uuid().optional(),
        forzar: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    const puedeOperaciones = ["admin", "jefe_operaciones", "operador"].some((r) => roles.includes(r));
    const puedeComercial = ["admin", "lider_cuenta", "comercial"].some((r) => roles.includes(r));
    if (!puedeOperaciones && !puedeComercial) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let operacionId = data.operacion_id ?? null;
    let cotizacionId = data.cotizacion_id ?? null;

    if (!operacionId && cotizacionId) {
      const { data: op } = await supabaseAdmin
        .from("operaciones")
        .select("id")
        .eq("cotizacion_id", cotizacionId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      operacionId = ((op ?? []) as Record<string, any>[])[0]?.["id"] ?? null;
    }
    if (!operacionId) throw new Error("La cotización aún no tiene una operación asociada.");

    if (!cotizacionId) {
      const { data: row } = await supabaseAdmin
        .from("operaciones")
        .select("cotizacion_id")
        .eq("id", operacionId)
        .maybeSingle();
      cotizacionId = (row as Record<string, any> | null)?.["cotizacion_id"] ?? null;
    }

    // El comercial sin rol de liderazgo sólo accede a las cargas de su cartera.
    const soloComercial = !puedeOperaciones && !["admin", "lider_cuenta"].some((r) => roles.includes(r));
    if (soloComercial) {
      if (!cotizacionId) throw new Error("Sin permisos sobre esta operación.");
      const { data: cot } = await supabaseAdmin
        .from("cotizaciones")
        .select("asignado_a")
        .eq("id", cotizacionId)
        .maybeSingle();
      if ((cot as Record<string, any> | null)?.["asignado_a"] !== userId) {
        throw new Error("Solo puedes descargar la asignación de tus propias cotizaciones.");
      }
    }

    const { obtenerAsignacionPDF } = await import("@/lib/asignacion-pdf.server");
    const r = await obtenerAsignacionPDF(operacionId, data.forzar ?? false);
    return { url: r.url, regenerado: r.regenerado, operacion_id: operacionId };
  });
