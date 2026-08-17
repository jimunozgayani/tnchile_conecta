import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";

/** Reintento manual de la generación de OC/OV de una operación (admin / líder). */
export const regenerarDocumentosOperacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ operacion_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!["admin", "lider_cuenta"].some((r) => roles.includes(r))) {
      throw new Error("Solo admin o líder de cuenta pueden regenerar los documentos.");
    }
    const { generarDocumentosSeguro } = await import("@/lib/documentos-operacion.server");
    return generarDocumentosSeguro(data.operacion_id);
  });
