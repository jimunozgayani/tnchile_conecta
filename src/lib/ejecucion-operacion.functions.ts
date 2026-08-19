import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";
import { ESTADOS_VIAJE, tipoFotoPara } from "@/lib/ejecucion-viaje";

const OPS = ["admin", "jefe_operaciones", "operador"];

export type EventoViajeItem = {
  id: string;
  tipo: string;
  estado_viaje: string | null;
  storage_path: string | null;
  nota: string | null;
  created_at: string;
  subido_por: string | null;
  autor: string;
};

export type EjecucionOperacion = {
  asignacion_id: string | null;
  estado_viaje: string | null;
  driver_id: string | null;
  driver_user_id: string | null;
  chofer_nombre: string | null;
  eventos: EventoViajeItem[];
  ultima_ubicacion: { lugar: string; fecha: string } | null;
};

/** Estado de ejecución del viaje ligado a una operación + eventos y última ubicación declarada. */
export const obtenerEjecucion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ operacion_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<EjecucionOperacion> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const vacio: EjecucionOperacion = {
      asignacion_id: null,
      estado_viaje: null,
      driver_id: null,
      driver_user_id: null,
      chofer_nombre: null,
      eventos: [],
      ultima_ubicacion: null,
    };

    const { data: opRow, error: opErr } = await supabaseAdmin
      .from("operaciones")
      .select("id, asignacion_id")
      .eq("id", data.operacion_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (opErr) throw new Error(opErr.message);
    const asignacionId = (opRow as Record<string, any> | null)?.["asignacion_id"] ?? null;
    if (!asignacionId) return vacio;

    const { data: asigRow } = await supabaseAdmin
      .from("asignaciones")
      .select("id, estado_viaje, chofer_id, drivers(id, user_id, nombre_completo)")
      .eq("id", asignacionId)
      .maybeSingle();
    const asig = (asigRow ?? {}) as Record<string, any>;
    const driver = (asig["drivers"] ?? null) as Record<string, any> | null;

    const [evRes, dispRes] = await Promise.all([
      supabaseAdmin
        .from("eventos_viaje")
        .select("id, tipo, estado_viaje, storage_path, nota, created_at, subido_por, chofer_id")
        .eq("asignacion_id", asignacionId)
        .order("created_at", { ascending: false }),
      driver?.["id"]
        ? supabaseAdmin
            .from("disponibilidad_chofer")
            .select("fecha_desde, lugar_texto, lugar_ciudad_id")
            .eq("driver_id", driver["id"])
            .order("fecha_desde", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] as Record<string, any>[] }),
    ]);

    const eventos = (evRes.data ?? []) as Record<string, any>[];

    // Nombres de quienes actuaron (staff o chofer) para etiquetar cada evento.
    const subidoPorIds = Array.from(
      new Set(eventos.map((e) => e["subido_por"]).filter((v): v is string => !!v)),
    );
    const nombres = new Map<string, string>();
    if (subidoPorIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nombre_contacto, razon_social, correo")
        .in("id", subidoPorIds);
      for (const p of (profs ?? []) as Record<string, any>[]) {
        nombres.set(p["id"], p["nombre_contacto"] || p["razon_social"] || p["correo"] || "Equipo TN");
      }
    }

    const driverUserId = driver?.["user_id"] ?? null;
    const disp = ((dispRes as any).data ?? [])[0] as Record<string, any> | undefined;
    let ciudadNombre: string | null = null;
    if (disp?.["lugar_ciudad_id"]) {
      const { data: ciudad } = await supabaseAdmin
        .from("ciudades_chile")
        .select("nombre")
        .eq("id", disp["lugar_ciudad_id"])
        .maybeSingle();
      ciudadNombre = (ciudad as Record<string, any> | null)?.["nombre"] ?? null;
    }

    return {
      asignacion_id: asignacionId,
      estado_viaje: (asig["estado_viaje"] as string) ?? "por_iniciar",
      driver_id: driver?.["id"] ?? null,
      driver_user_id: driverUserId,
      chofer_nombre: driver?.["nombre_completo"] ?? null,
      eventos: eventos.map((e) => {
        const sp = (e["subido_por"] as string | null) ?? null;
        const esChofer = !sp || (driverUserId && sp === driverUserId);
        return {
          id: e["id"],
          tipo: e["tipo"],
          estado_viaje: e["estado_viaje"] ?? null,
          storage_path: e["storage_path"] ?? null,
          nota: e["nota"] ?? null,
          created_at: e["created_at"],
          subido_por: sp,
          autor: esChofer ? "Subido por chofer" : `Subido por ${nombres.get(sp!) ?? "equipo TN"}`,
        };
      }),
      ultima_ubicacion: disp
        ? {
            lugar: ciudadNombre ?? disp["lugar_texto"] ?? "Sin ubicación declarada",
            fecha: disp["fecha_desde"],
          }
        : null,
    };
  });

/**
 * Avanza el estado del viaje de una asignación de forma atómica: actualiza la
 * asignación, registra el evento (foto y/o nota), y si el viaje queda entregado
 * finaliza la operación ligada. La foto se sube desde el cliente al bucket
 * privado y aquí sólo se registra su ruta.
 */
export const avanzarEstadoViaje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        asignacion_id: z.string().uuid(),
        nuevo_estado: z.enum(ESTADOS_VIAJE),
        storage_path: z.string().trim().max(500).optional(),
        nota: z.string().trim().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    const esStaff = OPS.some((r) => roles.includes(r));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: asigRow, error: asigErr } = await supabaseAdmin
      .from("asignaciones")
      .select("id, estado_viaje, chofer_id, drivers(id, user_id)")
      .eq("id", data.asignacion_id)
      .maybeSingle();
    if (asigErr) throw new Error(asigErr.message);
    if (!asigRow) throw new Error("Asignación no encontrada.");
    const asig = asigRow as Record<string, any>;
    const driverUserId: string | null = asig["drivers"]?.user_id ?? null;

    if (!esStaff) {
      // El propio chofer asignado también puede avanzar (misma regla que la RLS actual).
      const { data: propios } = await supabaseAdmin.rpc("chofer_driver_ids", { _uid: userId } as never);
      const ids = ((propios ?? []) as any[]).map((r: any) => (typeof r === "string" ? r : r?.chofer_driver_ids));
      if (!ids.includes(asig["chofer_id"])) throw new Error("Sin permisos.");
    }

    const { error: updErr } = await supabaseAdmin
      .from("asignaciones")
      .update({ estado_viaje: data.nuevo_estado, updated_at: new Date().toISOString() } as never)
      .eq("id", data.asignacion_id);
    if (updErr) throw new Error(updErr.message);

    const choferIdEvento = driverUserId ?? userId;

    await supabaseAdmin.from("eventos_viaje").insert({
      asignacion_id: data.asignacion_id,
      chofer_id: choferIdEvento,
      subido_por: userId,
      tipo: "cambio_estado",
      estado_viaje: data.nuevo_estado,
    } as never);

    if (data.storage_path) {
      const tipo = tipoFotoPara(data.nuevo_estado) ?? "foto_guia";
      const { error: fotoErr } = await supabaseAdmin.from("eventos_viaje").insert({
        asignacion_id: data.asignacion_id,
        chofer_id: choferIdEvento,
        subido_por: userId,
        tipo,
        estado_viaje: data.nuevo_estado,
        storage_path: data.storage_path,
      } as never);
      if (fotoErr) throw new Error(fotoErr.message);
    }

    if (data.nota) {
      const { error: notaErr } = await supabaseAdmin.from("eventos_viaje").insert({
        asignacion_id: data.asignacion_id,
        chofer_id: choferIdEvento,
        subido_por: userId,
        tipo: "nota",
        estado_viaje: data.nuevo_estado,
        nota: data.nota,
      } as never);
      if (notaErr) throw new Error(notaErr.message);
    }

    let operacionFinalizada: string | null = null;
    if (data.nuevo_estado === "entregado") {
      const { data: opRows } = await supabaseAdmin
        .from("operaciones")
        .update({
          estado: "finalizada",
          finalizada_at: new Date().toISOString(),
          finalizada_por: userId,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("asignacion_id", data.asignacion_id)
        .neq("estado", "finalizada")
        .is("deleted_at", null)
        .select("id");
      const opId = ((opRows ?? []) as Record<string, any>[])[0]?.["id"] ?? null;
      if (opId) {
        operacionFinalizada = opId;
        await supabaseAdmin.from("audit_log").insert({
          tabla_nombre: "operaciones",
          registro_id: opId,
          accion: "operacion_finalizada_por_entrega",
          datos_nuevos: { asignacion_id: data.asignacion_id, finalizada_por: userId },
          usuario_id: userId,
        } as never);
        // Terminada físicamente: pasa de inmediato a la fase de cobro paralelo.
        const { pasarACobroPendiente } = await import("@/lib/pagos-cierre.server");
        await pasarACobroPendiente(opId, userId);
      }
    }


    const { error: audErr } = await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "asignaciones",
      registro_id: data.asignacion_id,
      accion: "estado_viaje_avanzado",
      datos_nuevos: {
        asignacion_id: data.asignacion_id,
        nuevoEstado: data.nuevo_estado,
        subido_por: userId,
        con_foto: !!data.storage_path,
        con_nota: !!data.nota,
      },
      usuario_id: userId,
    } as never);
    if (audErr) console.error("audit_log insert failed", audErr.message);

    return { ok: true, estado_viaje: data.nuevo_estado, operacion_finalizada: operacionFinalizada };
  });
