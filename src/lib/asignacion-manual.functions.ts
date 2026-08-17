import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";
import type { Candidato } from "@/lib/asignacion-manual.server";

const OPS = ["admin", "jefe_operaciones", "operador"];

export type CandidatosResultado = {
  fecha_carga: string | null;
  tipo_requerido: string | null;
  candidatos: Candidato[];
};

/** Choferes aprobados y disponibles con camión compatible para una operación. */
export const candidatosAsignacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ operacion_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CandidatosResultado> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { construirCandidatos } = await import("@/lib/asignacion-manual.server");

    const { data: opRow, error: opErr } = await supabaseAdmin
      .from("operaciones")
      .select("id, fecha_carga, tipo_camion_otro, cotizacion_id, tipos_camion(nombre), cotizaciones(tipo_camion)")
      .eq("id", data.operacion_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (opErr) throw new Error(opErr.message);
    if (!opRow) throw new Error("Operación no encontrada.");
    const op = opRow as Record<string, any>;

    // Cadena de fallback: catálogo → "otro" → texto legacy de la cotización → sin filtro.
    const tipoRequerido: string | null =
      op["tipos_camion"]?.nombre ?? op["tipo_camion_otro"] ?? op["cotizaciones"]?.tipo_camion ?? null;
    const fecha: string | null = op["fecha_carga"] ?? null;

    const [drv, perf, dispRes, trk, prof] = await Promise.all([
      supabaseAdmin.from("drivers").select("id, nombre_completo, rut, user_id, clase_licencia").is("deleted_at", null),
      supabaseAdmin.from("chofer_perfiles").select("user_id, proveedor_id, rut, estado_validacion").eq("estado_validacion", "aprobado"),
      supabaseAdmin.from("disponibilidad_chofer").select("driver_id, estado, fecha_desde, fecha_hasta, truck_id, lugar_texto, destino_texto").eq("estado", "disponible"),
      supabaseAdmin.from("trucks").select("id, patente, tipo, user_id").is("deleted_at", null),
      supabaseAdmin.from("profiles").select("id, razon_social").is("deleted_at", null),
    ]);

    return {
      fecha_carga: fecha,
      tipo_requerido: tipoRequerido,
      candidatos: construirCandidatos({
        fecha,
        tipoRequerido,
        drivers: (drv.data ?? []) as Record<string, any>[],
        perfiles: (perf.data ?? []) as Record<string, any>[],
        disponibilidad: (dispRes.data ?? []) as Record<string, any>[],
        trucks: (trk.data ?? []) as Record<string, any>[],
        profiles: (prof.data ?? []) as Record<string, any>[],
      }),
    };
  });

/** Crea la asignación manual, la enlaza a la operación y avanza el estado. */
export const asignarChoferManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        operacion_id: z.string().uuid(),
        chofer_id: z.string().uuid(),
        camion_id: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: opRow, error: opErr } = await supabaseAdmin
      .from("operaciones")
      .select("id, estado, asignacion_id, cotizacion_id, fecha_carga")
      .eq("id", data.operacion_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (opErr) throw new Error(opErr.message);
    if (!opRow) throw new Error("Operación no encontrada.");
    const op = opRow as Record<string, any>;
    if (op["asignacion_id"]) throw new Error("La operación ya tiene una asignación activa.");

    const { data: drvRow } = await supabaseAdmin
      .from("drivers")
      .select("id, user_id")
      .eq("id", data.chofer_id)
      .maybeSingle();
    const proveedorId = (drvRow as Record<string, any> | null)?.["user_id"] ?? null;
    if (!proveedorId) throw new Error("El chofer no tiene proveedor asociado.");

    const { data: asigRow, error: asigErr } = await supabaseAdmin
      .from("asignaciones")
      .insert({
        chofer_id: data.chofer_id,
        camion_id: data.camion_id,
        proveedor_id: proveedorId,
        cotizacion_id: op["cotizacion_id"] ?? null,
        estado_viaje: "por_iniciar",
        activa: true,
        creado_por: userId,
        fecha_desde: op["fecha_carga"] ?? new Date().toISOString().slice(0, 10),
      } as never)
      .select("id")
      .single();
    if (asigErr) throw new Error(asigErr.message);
    const asignacionId = (asigRow as Record<string, any>)["id"] as string;

    // Transición esperada tras asignar: lista_para_operar → confirmada.
    const nuevoEstado = op["estado"] === "lista_para_operar" ? "confirmada" : op["estado"];
    const { error: updErr } = await supabaseAdmin
      .from("operaciones")
      .update({ asignacion_id: asignacionId, estado: nuevoEstado, updated_at: new Date().toISOString() } as never)
      .eq("id", data.operacion_id);
    if (updErr) throw new Error(updErr.message);

    const { error: audErr } = await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "operaciones",
      registro_id: data.operacion_id,
      accion: "asignacion_manual_operacion",
      datos_nuevos: {
        asignacion_id: asignacionId,
        chofer_id: data.chofer_id,
        camion_id: data.camion_id,
        estado: nuevoEstado,
      },
      usuario_id: userId,
    } as never);
    if (audErr) console.error("audit_log insert failed", audErr.message);

    return { ok: true, asignacion_id: asignacionId, estado: nuevoEstado as string };
  });

/** Desactiva la asignación de la operación (para cancelar o reasignar). */
export const cancelarAsignacionOperacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ operacion_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: opRow, error: opErr } = await supabaseAdmin
      .from("operaciones")
      .select("id, estado, asignacion_id")
      .eq("id", data.operacion_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (opErr) throw new Error(opErr.message);
    if (!opRow) throw new Error("Operación no encontrada.");
    const op = opRow as Record<string, any>;
    if (!op["asignacion_id"]) return { ok: true, estado: op["estado"] as string };

    await supabaseAdmin
      .from("asignaciones")
      .update({ activa: false, updated_at: new Date().toISOString() } as never)
      .eq("id", op["asignacion_id"]);

    const nuevoEstado = op["estado"] === "confirmada" ? "lista_para_operar" : op["estado"];
    const { error: updErr } = await supabaseAdmin
      .from("operaciones")
      .update({ asignacion_id: null, estado: nuevoEstado, updated_at: new Date().toISOString() } as never)
      .eq("id", data.operacion_id);
    if (updErr) throw new Error(updErr.message);

    const { error: audErr } = await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "operaciones",
      registro_id: data.operacion_id,
      accion: "asignacion_manual_cancelada",
      datos_nuevos: { asignacion_id: op["asignacion_id"], estado: nuevoEstado },
      usuario_id: userId,
    } as never);
    if (audErr) console.error("audit_log insert failed", audErr.message);

    return { ok: true, estado: nuevoEstado as string };
  });
