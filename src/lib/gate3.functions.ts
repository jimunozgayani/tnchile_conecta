import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";

/** Solo Admin o Líder de Cuenta autorizan el paso a Operaciones (Gate 3). */
export const GATE3_ROLES = ["admin", "lider_cuenta"];

export const autorizarGate3 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!GATE3_ROLES.some((r) => roles.includes(r))) {
      throw new Error("Solo admin o líder de cuenta pueden autorizar el paso a Operaciones.");
    }

    const { crearOperacionDesdeCotizacion, auditCotizacion } = await import(
      "@/lib/operaciones-crear.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("cotizaciones")
      .update({
        gate3_autorizado_at: now,
        gate3_autorizado_por: userId,
        updated_at: now,
      } as never)
      .eq("id", data.id)
      .eq("estado", "lista_para_operar");
    if (error) throw new Error(error.message);

    const op = await crearOperacionDesdeCotizacion(data.id, userId);

    await auditCotizacion(
      data.id,
      "gate3_autorizado",
      {
        estado: "lista_para_operar",
        operacion_id: op.operacion_id,
        numero_operacion: op.numero_operacion,
        gate3_autorizado_at: now,
      },
      userId,
    );

    // OC y OV: generación best-effort — un fallo nunca revierte la autorización.
    let docs = { folio_oc: null as string | null, folio_ov: null as string | null, errores: [] as string[] };
    try {
      const { generarDocumentosSeguro } = await import("@/lib/documentos-operacion.server");
      docs = await generarDocumentosSeguro(op.operacion_id);
    } catch (e) {
      docs.errores.push(e instanceof Error ? e.message : "error al generar documentos");
    }

    await auditCotizacion(
      data.id,
      "documentos_generados",
      {
        operacion_id: op.operacion_id,
        folio_oc: docs.folio_oc,
        folio_ov: docs.folio_ov,
        ...(docs.errores.length > 0 ? { errores: docs.errores } : {}),
      },
      userId,
    );

    return { ...op, folio_oc: docs.folio_oc, folio_ov: docs.folio_ov, errores: docs.errores };
  });

export const retenerGate3 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        comentario: z.string().trim().min(10, "El comentario es obligatorio (mínimo 10 caracteres)."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!GATE3_ROLES.some((r) => roles.includes(r))) {
      throw new Error("Solo admin o líder de cuenta pueden retener el paso a Operaciones.");
    }

    const { auditCotizacion } = await import("@/lib/operaciones-crear.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("cotizaciones")
      .update({ estado: "aceptada", updated_at: now } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Soft-delete la ficha de operación creada al sellar el cierre, para que
    // desaparezca de la cola de Operaciones.
    const { data: ops, error: oErr } = await supabaseAdmin
      .from("operaciones")
      .update({ deleted_at: now, updated_at: now } as never)
      .eq("cotizacion_id", data.id)
      .is("deleted_at", null)
      .select("id");
    if (oErr) throw new Error(oErr.message);

    for (const op of (ops ?? []) as { id: string }[]) {
      await auditCotizacion(
        data.id,
        "operacion_retenida_por_gate3",
        { operacion_id: op.id, comentario: data.comentario },
        userId,
      );
    }

    await auditCotizacion(
      data.id,
      "gate3_retenido",
      { estado: "aceptada", comentario: data.comentario },
      userId,
    );

    return { ok: true, estado: "aceptada" as const, operaciones_retenidas: (ops ?? []).length };
  });

