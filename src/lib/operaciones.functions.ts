import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";

const COMERCIAL_SELLA = ["admin", "lider_cuenta", "comercial"];
const OPS_AVANZA = ["admin", "jefe_operaciones", "operador"];
const STAFF = ["admin", "lider_cuenta", "jefe_operaciones", "operador", "comercial"];

export const TRANSICIONES_OPERACION: Record<string, string> = {
  lista_para_operar: "confirmada",
  confirmada: "en_operacion",
  en_operacion: "finalizada",
  finalizada: "cobro_pendiente",
};

export type Operacion = {
  id: string;
  numero_operacion: number;
  estado: string;
  cotizacion_id: string | null;
  asignacion_id: string | null;
  contacto_id: string | null;
  contacto_nombre: string | null;
  origen: string | null;
  destino: string | null;
  descripcion_exacta: string | null;
  requerimientos_especiales: string | null;
  notas_internas: string | null;
  fecha_carga: string | null;
  tipo_camion: string | null;
  peso_kg: number | null;
  dimensiones: string | null;
  precio_ofrecido_cliente_clp: number | null;
  precio_maximo_proveedor_clp: number | null;
  precio_proveedor_confirmado_clp: number | null;
  monto_adelanto_clp: number | null;
  fotos: string[];
  fotos_descarga: string[];
  chofer_nombre: string | null;
  camion_patente: string | null;
  pasada_a_operaciones_at: string | null;
};

const primerDestino = (destinos: unknown): string | null => {
  if (!Array.isArray(destinos) || destinos.length === 0) return null;
  const d = destinos[0];
  if (typeof d === "string") return d;
  if (d && typeof d === "object") {
    const o = d as Record<string, unknown>;
    const v = o["direccion"] ?? o["nombre"] ?? o["destino"] ?? o["ciudad"];
    return typeof v === "string" ? v : null;
  }
  return null;
};

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

async function audit(
  registro_id: string,
  accion: string,
  datos_nuevos: Record<string, unknown>,
  usuario_id: string,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("audit_log").insert({
    tabla_nombre: "operaciones",
    registro_id,
    accion,
    datos_nuevos,
    usuario_id,
  } as never);
  if (error) console.error("audit_log insert failed", error.message);
}

/**
 * Sella el cierre comercial: solo deja la cotización en `lista_para_operar`.
 * NO crea operación ni asignación — eso ocurre únicamente en el Gate 3.
 */
export const sellarCierre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cotizacion_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!COMERCIAL_SELLA.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("cotizaciones")
      .update({ estado: "lista_para_operar", updated_at: now } as never)
      .eq("id", data.cotizacion_id);
    if (error) throw new Error(error.message);

    const { auditCotizacion } = await import("@/lib/operaciones-crear.server");
    await auditCotizacion(data.cotizacion_id, "cierre_sellado", { estado: "lista_para_operar" }, userId);

    return { ok: true, estado: "lista_para_operar" as const };
  });


/** Avanza el estado de la operación respetando las transiciones válidas. */
export const actualizarEstadoOperacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        operacion_id: z.string().uuid(),
        nuevo_estado: z.enum(["confirmada", "en_operacion", "finalizada", "cobro_pendiente"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_AVANZA.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: rErr } = await supabaseAdmin
      .from("operaciones")
      .select("id, estado, cotizacion_id")
      .eq("id", data.operacion_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!row) throw new Error("Operación no encontrada.");

    const actual = row as { estado: string; cotizacion_id: string | null };
    if (TRANSICIONES_OPERACION[actual.estado] !== data.nuevo_estado) {
      throw new Error(`Transición no permitida: ${actual.estado} → ${data.nuevo_estado}`);
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { estado: data.nuevo_estado, updated_at: now };
    if (data.nuevo_estado === "finalizada") {
      patch["finalizada_at"] = now;
      patch["finalizada_por"] = userId;
    }

    const { error } = await supabaseAdmin
      .from("operaciones")
      .update(patch as never)
      .eq("id", data.operacion_id);
    if (error) throw new Error(error.message);

    // Al pasar a cobro pendiente, el control vuelve al área Comercial.
    if (data.nuevo_estado === "cobro_pendiente" && actual.cotizacion_id) {
      await supabaseAdmin
        .from("cotizaciones")
        .update({ estado: "cobro_pendiente", updated_at: now } as never)
        .eq("id", actual.cotizacion_id);
    }

    await audit(data.operacion_id, `estado_${data.nuevo_estado}`, { estado: data.nuevo_estado, anterior: actual.estado }, userId);

    return { ok: true, estado: data.nuevo_estado };
  });

/** Ficha completa de la operación (con contacto y asignación resueltos). */
export const obtenerOperacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Operacion> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!STAFF.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("operaciones")
      .select(
        "*, contactos(nombre), tipos_camion(nombre), asignaciones(id, drivers(nombre_completo), trucks(patente))",
      )
      .eq("id", data.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Operación no encontrada.");

    const o = row as Record<string, any>;
    return {
      id: o["id"],
      numero_operacion: o["numero_operacion"],
      estado: o["estado"],
      cotizacion_id: o["cotizacion_id"] ?? null,
      asignacion_id: o["asignacion_id"] ?? null,
      contacto_id: o["contacto_id"] ?? null,
      contacto_nombre: o["contactos"]?.nombre ?? null,
      origen: o["origen"] ?? null,
      destino: o["destino"] ?? null,
      descripcion_exacta: o["descripcion_exacta"] ?? null,
      requerimientos_especiales: o["requerimientos_especiales"] ?? null,
      notas_internas: o["notas_internas"] ?? null,
      fecha_carga: o["fecha_carga"] ?? null,
      tipo_camion: o["tipos_camion"]?.nombre ?? o["tipo_camion_otro"] ?? null,
      peso_kg: o["peso_kg"] ?? null,
      dimensiones: o["dimensiones"] ?? null,
      precio_ofrecido_cliente_clp: o["precio_ofrecido_cliente_clp"] ?? null,
      precio_maximo_proveedor_clp: o["precio_maximo_proveedor_clp"] ?? null,
      precio_proveedor_confirmado_clp: o["precio_proveedor_confirmado_clp"] ?? null,
      monto_adelanto_clp: o["monto_adelanto_clp"] ?? null,
      fotos: arr(o["fotos"]),
      fotos_descarga: arr(o["fotos_descarga"]),
      chofer_nombre: o["asignaciones"]?.drivers?.nombre_completo ?? null,
      camion_patente: o["asignaciones"]?.trucks?.patente ?? null,
      pasada_a_operaciones_at: o["pasada_a_operaciones_at"] ?? null,
    };
  });

const patchSchema = z.object({
  id: z.string().uuid(),
  descripcion_exacta: z.string().trim().max(4000).nullable().optional(),
  requerimientos_especiales: z.string().trim().max(4000).nullable().optional(),
  notas_internas: z.string().trim().max(4000).nullable().optional(),
  fecha_carga: z.string().trim().max(10).nullable().optional(),
  precio_proveedor_confirmado_clp: z.number().nonnegative().nullable().optional(),
  monto_adelanto_clp: z.number().nonnegative().nullable().optional(),
});

/** Guarda los campos editables de la ficha. */
export const guardarOperacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_AVANZA.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { id, ...rest } = data;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v === "" ? null : v;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("operaciones")
      .update(patch as never)
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type OperacionResumen = {
  id: string;
  numero_operacion: number;
  estado: string;
  contacto_nombre: string | null;
  origen: string | null;
  destino: string | null;
  fecha_carga: string | null;
  asignacion_id: string | null;
};

/** Operaciones activas para el panel de Operaciones. */
export const listarOperacionesActivas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OperacionResumen[]> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!STAFF.some((r) => roles.includes(r))) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("operaciones")
      .select("id, numero_operacion, estado, origen, destino, fecha_carga, asignacion_id, contactos(nombre)")
      .in("estado", ["lista_para_operar", "confirmada", "en_operacion"])
      .is("deleted_at", null)
      .order("fecha_carga", { ascending: true, nullsFirst: false })
      .limit(20);
    if (error) throw new Error(error.message);

    return ((data ?? []) as Record<string, any>[]).map((o) => ({
      id: o["id"],
      numero_operacion: o["numero_operacion"],
      estado: o["estado"],
      contacto_nombre: o["contactos"]?.nombre ?? null,
      origen: o["origen"] ?? null,
      destino: o["destino"] ?? null,
      fecha_carga: o["fecha_carga"] ?? null,
      asignacion_id: o["asignacion_id"] ?? null,
    }));
  });

/** Mapa asignacion_id → { operacion_id, numero_operacion } para enlazar fichas. */
export const listarOperacionesPorAsignacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, { id: string; numero_operacion: number }>> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!STAFF.some((r) => roles.includes(r))) return {};

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("operaciones")
      .select("id, numero_operacion, asignacion_id, cotizacion_id")
      .is("deleted_at", null);
    if (error) throw new Error(error.message);

    const out: Record<string, { id: string; numero_operacion: number }> = {};
    for (const o of (data ?? []) as Record<string, any>[]) {
      const entry = { id: o["id"], numero_operacion: o["numero_operacion"] };
      if (o["asignacion_id"]) out[o["asignacion_id"] as string] = entry;
      if (o["cotizacion_id"]) out[`cot:${o["cotizacion_id"] as string}`] = entry;
    }
    return out;
  });

export type OperacionLista = OperacionResumen & { chofer_nombre: string | null };

/**
 * Operaciones visibles para "Mis Operaciones".
 * admin / jefe_operaciones ven todas; el operador ve solo las que ganó
 * (propuesta ganadora) o las que él asignó (asignaciones.creado_por).
 */
export const listarMisOperaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OperacionLista[]> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!["admin", "jefe_operaciones", "operador"].some((r) => roles.includes(r))) return [];
    const verTodo = roles.includes("admin") || roles.includes("jefe_operaciones");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("operaciones")
      .select(
        "id, numero_operacion, estado, origen, destino, fecha_carga, asignacion_id, cotizacion_id, chofer_nombre, contactos(nombre), asignaciones(creado_por, drivers(nombre_completo))",
      )
      .is("deleted_at", null)
      .order("fecha_carga", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Record<string, any>[];

    let permitidas: Set<string> | null = null;
    if (!verTodo) {
      permitidas = new Set<string>();
      const cotIds = rows.map((o) => o["cotizacion_id"]).filter(Boolean) as string[];
      const cotOk = new Set<string>();
      if (cotIds.length > 0) {
        const { data: cots } = await supabaseAdmin
          .from("cotizaciones")
          .select("id, propuesta_ganadora_id")
          .in("id", cotIds);
        const propIds = ((cots ?? []) as Record<string, any>[])
          .map((c) => c["propuesta_ganadora_id"])
          .filter(Boolean) as string[];
        const misPropuestas = new Set<string>();
        if (propIds.length > 0) {
          const { data: props } = await supabaseAdmin
            .from("propuestas_proveedor")
            .select("id, operador_id")
            .in("id", propIds)
            .eq("operador_id", userId);
          for (const p of ((props ?? []) as Record<string, any>[])) misPropuestas.add(p["id"] as string);
        }
        for (const c of ((cots ?? []) as Record<string, any>[])) {
          if (c["propuesta_ganadora_id"] && misPropuestas.has(c["propuesta_ganadora_id"])) {
            cotOk.add(c["id"] as string);
          }
        }
      }
      for (const o of rows) {
        const porPropuesta = !!o["cotizacion_id"] && cotOk.has(o["cotizacion_id"] as string);
        const porAsignacion = o["asignaciones"]?.creado_por === userId;
        if (porPropuesta || porAsignacion) permitidas.add(o["id"] as string);
      }
    }

    return rows
      .filter((o) => permitidas === null || permitidas.has(o["id"] as string))
      .map((o) => ({
        id: o["id"],
        numero_operacion: o["numero_operacion"],
        estado: o["estado"],
        contacto_nombre: o["contactos"]?.nombre ?? null,
        origen: o["origen"] ?? null,
        destino: o["destino"] ?? null,
        fecha_carga: o["fecha_carga"] ?? null,
        asignacion_id: o["asignacion_id"] ?? null,
        chofer_nombre: o["asignaciones"]?.drivers?.nombre_completo ?? o["chofer_nombre"] ?? null,
      }));
  });
