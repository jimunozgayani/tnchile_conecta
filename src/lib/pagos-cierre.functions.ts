import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";
import type { LadoPagos } from "@/lib/pagos-cierre.server";

export type EstadoPagos = LadoPagos | null;

/** Estado de pagos/cobros de una operación (por id de operación o de cotización). */
export const obtenerEstadoPagos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        operacion_id: z.string().uuid().optional(),
        cotizacion_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<EstadoPagos> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    const STAFF = ["admin", "lider_cuenta", "jefe_operaciones", "operador", "comercial"];
    if (!STAFF.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { leerPagosPorCotizacion, leerPagosPorOperacion } = await import("@/lib/pagos-cierre.server");
    if (data.operacion_id) return await leerPagosPorOperacion(data.operacion_id);
    if (data.cotizacion_id) return await leerPagosPorCotizacion(data.cotizacion_id);
    return null;
  });

/** Registra el pago al proveedor (lado Operaciones) y evalúa el cierre. */
export const registrarPagoProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        operacion_id: z.string().uuid(),
        monto_pago_proveedor_clp: z.number().nonnegative().nullable().optional(),
        fecha_pago_proveedor: z.string().trim().max(10).optional(),
        monto_adelanto_clp: z.number().nonnegative().nullable().optional(),
        fecha_pago_adelanto: z.string().trim().max(10).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!["admin", "jefe_operaciones", "operador"].some((r) => roles.includes(r))) {
      throw new Error("Sin permisos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditarOperacion, cerrarSiAmbosResueltos, leerPagosPorOperacion } = await import(
      "@/lib/pagos-cierre.server"
    );

    const actual = await leerPagosPorOperacion(data.operacion_id);
    if (!actual) throw new Error("Operación no encontrada.");
    if (!["finalizada", "cobro_pendiente", "cerrada"].includes(actual.estado)) {
      throw new Error("La operación aún no está finalizada.");
    }

    const fecha = data.fecha_pago_proveedor?.trim() || new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = {
      fecha_pago_proveedor: fecha,
      updated_at: new Date().toISOString(),
    };
    if (data.monto_pago_proveedor_clp !== undefined) {
      patch["monto_pago_proveedor_clp"] = data.monto_pago_proveedor_clp;
    }
    if (data.monto_adelanto_clp !== undefined) patch["monto_adelanto_clp"] = data.monto_adelanto_clp;
    if (data.fecha_pago_adelanto !== undefined) {
      patch["fecha_pago_adelanto"] = data.fecha_pago_adelanto || null;
    }

    const { error } = await supabaseAdmin
      .from("operaciones")
      .update(patch as never)
      .eq("id", data.operacion_id);
    if (error) throw new Error(error.message);

    await auditarOperacion(
      data.operacion_id,
      "pago_proveedor_registrado",
      {
        fecha_pago_proveedor: fecha,
        monto_pago_proveedor_clp: patch["monto_pago_proveedor_clp"] ?? actual.monto_pago_proveedor_clp,
        monto_adelanto_clp: patch["monto_adelanto_clp"] ?? actual.monto_adelanto_clp,
      },
      userId,
    );

    const cierre = await cerrarSiAmbosResueltos(data.operacion_id, userId);
    return { ok: true, ...cierre };
  });

/** Registra el cobro al cliente (lado Comercial) y evalúa el cierre. */
export const registrarCobroCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cotizacion_id: z.string().uuid(),
        monto_cobro_cliente_clp: z.number().nonnegative().nullable().optional(),
        fecha_cobro_cliente: z.string().trim().max(10).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    const puedeTodo = ["admin", "lider_cuenta"].some((r) => roles.includes(r));
    if (!puedeTodo && !roles.includes("comercial")) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditarOperacion, cerrarSiAmbosResueltos, leerPagosPorCotizacion } = await import(
      "@/lib/pagos-cierre.server"
    );

    if (!puedeTodo) {
      // El comercial sólo puede registrar el cobro de su propia cartera.
      const { data: cot } = await supabaseAdmin
        .from("cotizaciones")
        .select("asignado_a")
        .eq("id", data.cotizacion_id)
        .maybeSingle();
      if ((cot as Record<string, any> | null)?.["asignado_a"] !== userId) {
        throw new Error("Solo puedes registrar el cobro de tus propias cotizaciones.");
      }
    }

    const actual = await leerPagosPorCotizacion(data.cotizacion_id);
    if (!actual) throw new Error("La cotización no tiene una operación asociada.");
    if (!["finalizada", "cobro_pendiente", "cerrada"].includes(actual.estado)) {
      throw new Error("La operación aún no está finalizada.");
    }

    const fecha = data.fecha_cobro_cliente?.trim() || new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = {
      fecha_cobro_cliente: fecha,
      updated_at: new Date().toISOString(),
    };
    if (data.monto_cobro_cliente_clp !== undefined) {
      patch["monto_cobro_cliente_clp"] = data.monto_cobro_cliente_clp;
    }

    const { error } = await supabaseAdmin
      .from("operaciones")
      .update(patch as never)
      .eq("id", actual.operacion_id);
    if (error) throw new Error(error.message);

    await auditarOperacion(
      actual.operacion_id,
      "cobro_cliente_registrado",
      {
        cotizacion_id: data.cotizacion_id,
        fecha_cobro_cliente: fecha,
        monto_cobro_cliente_clp: patch["monto_cobro_cliente_clp"] ?? actual.monto_cobro_cliente_clp,
      },
      userId,
    );

    const cierre = await cerrarSiAmbosResueltos(actual.operacion_id, userId);
    return { ok: true, ...cierre };
  });

// ─────────────────────────────────────────────────────────────
// Comprobantes de pago al proveedor (adjuntos)
// ─────────────────────────────────────────────────────────────

export type ComprobantePago = {
  path: string;
  nombre_archivo: string;
  subido_por: string | null;
  subido_at: string;
  subido_por_nombre?: string | null;
};

const SUBEN = ["admin", "jefe_operaciones"];
const VEN = ["admin", "jefe_operaciones", "operador", "lider_cuenta"];

async function nombresDe(ids: string[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, nombre_contacto, razon_social, correo")
    .in("id", unicos);
  const out: Record<string, string> = {};
  for (const p of (data ?? []) as Array<Record<string, string | null>>) {
    out[p["id"] as string] =
      p["nombre_contacto"] || p["razon_social"] || p["correo"] || "Usuario interno";
  }
  return out;
}

async function leerComprobantes(operacionId: string): Promise<ComprobantePago[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("operaciones")
    .select("comprobantes_pago_proveedor")
    .eq("id", operacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = (data as Record<string, unknown> | null)?.["comprobantes_pago_proveedor"];
  const lista = Array.isArray(raw) ? (raw as ComprobantePago[]) : [];
  const nombres = await nombresDe(lista.map((c) => c.subido_por ?? ""));
  return lista.map((c) => ({
    ...c,
    subido_por_nombre: c.subido_por ? (nombres[c.subido_por] ?? null) : null,
  }));
}

/** Lista los comprobantes de pago al proveedor de una operación. */
export const listarComprobantesPagoProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ operacion_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ComprobantePago[]> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!VEN.some((r) => roles.includes(r))) throw new Error("Sin permisos.");
    return await leerComprobantes(data.operacion_id);
  });

/** Registra un comprobante ya subido al bucket 'documentos-operacion'. */
export const registrarComprobantePagoProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        operacion_id: z.string().uuid(),
        path: z.string().trim().min(1).max(500),
        nombre_archivo: z.string().trim().min(1).max(255),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ComprobantePago[]> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!SUBEN.some((r) => roles.includes(r))) {
      throw new Error("Solo admin o jefe de operaciones puede subir comprobantes.");
    }
    if (!data.path.startsWith(`comprobantes/${data.operacion_id}/`)) {
      throw new Error("Ruta de archivo inválida.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { auditarOperacion } = await import("@/lib/pagos-cierre.server");

    const actuales = await leerComprobantes(data.operacion_id);
    const entrada = {
      path: data.path,
      nombre_archivo: data.nombre_archivo,
      subido_por: userId,
      subido_at: new Date().toISOString(),
    };
    const nueva = [
      ...actuales.map(({ subido_por_nombre: _n, ...c }) => c),
      entrada,
    ];

    const { error } = await supabaseAdmin
      .from("operaciones")
      .update({
        comprobantes_pago_proveedor: nueva,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.operacion_id);
    if (error) throw new Error(error.message);

    await auditarOperacion(
      data.operacion_id,
      "comprobante_pago_proveedor_subido",
      entrada,
      userId,
    );

    return await leerComprobantes(data.operacion_id);
  });
