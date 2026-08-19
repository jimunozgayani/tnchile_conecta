/**
 * Lógica compartida del cierre paralelo: Operaciones cierra su parte al
 * registrar el pago al proveedor y Comercial al registrar el cobro al cliente.
 * La operación (y su cotización) sólo llegan a 'cerrada' cuando AMBOS lados
 * quedan resueltos.
 */

export type LadoPagos = {
  operacion_id: string;
  estado: string;
  cotizacion_id: string | null;
  fecha_pago_adelanto: string | null;
  monto_adelanto_clp: number | null;
  fecha_pago_proveedor: string | null;
  monto_pago_proveedor_clp: number | null;
  fecha_cobro_cliente: string | null;
  monto_cobro_cliente_clp: number | null;
  precio_proveedor_confirmado_clp: number | null;
  precio_ofrecido_cliente_clp: number | null;
};

const CAMPOS =
  "id, estado, cotizacion_id, fecha_pago_adelanto, monto_adelanto_clp, fecha_pago_proveedor, monto_pago_proveedor_clp, fecha_cobro_cliente, monto_cobro_cliente_clp, precio_proveedor_confirmado_clp, precio_ofrecido_cliente_clp";

export async function auditarOperacion(
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

function mapear(o: Record<string, any>): LadoPagos {
  return {
    operacion_id: o["id"],
    estado: o["estado"],
    cotizacion_id: o["cotizacion_id"] ?? null,
    fecha_pago_adelanto: o["fecha_pago_adelanto"] ?? null,
    monto_adelanto_clp: o["monto_adelanto_clp"] ?? null,
    fecha_pago_proveedor: o["fecha_pago_proveedor"] ?? null,
    monto_pago_proveedor_clp: o["monto_pago_proveedor_clp"] ?? null,
    fecha_cobro_cliente: o["fecha_cobro_cliente"] ?? null,
    monto_cobro_cliente_clp: o["monto_cobro_cliente_clp"] ?? null,
    precio_proveedor_confirmado_clp: o["precio_proveedor_confirmado_clp"] ?? null,
    precio_ofrecido_cliente_clp: o["precio_ofrecido_cliente_clp"] ?? null,
  };
}

/** Estado de pagos por id de operación. */
export async function leerPagosPorOperacion(operacionId: string): Promise<LadoPagos | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("operaciones")
    .select(CAMPOS)
    .eq("id", operacionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapear(data as Record<string, any>) : null;
}

/** Estado de pagos de la operación ligada a una cotización (la más reciente). */
export async function leerPagosPorCotizacion(cotizacionId: string): Promise<LadoPagos | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("operaciones")
    .select(CAMPOS)
    .eq("cotizacion_id", cotizacionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as Record<string, any>[])[0];
  return row ? mapear(row) : null;
}

/**
 * Chequeo compartido: si ambos lados están resueltos, cierra la operación y
 * sincroniza la cotización. Se llama desde AMBAS acciones de registro.
 */
export async function cerrarSiAmbosResueltos(
  operacionId: string,
  usuarioId: string,
): Promise<{ cerrada: boolean; estado: string }> {
  const actual = await leerPagosPorOperacion(operacionId);
  if (!actual) throw new Error("Operación no encontrada.");
  if (actual.estado === "cerrada") return { cerrada: true, estado: "cerrada" };
  if (!actual.fecha_pago_proveedor || !actual.fecha_cobro_cliente) {
    return { cerrada: false, estado: actual.estado };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("operaciones")
    .update({ estado: "cerrada", updated_at: now } as never)
    .eq("id", operacionId);
  if (error) throw new Error(error.message);

  if (actual.cotizacion_id) {
    await supabaseAdmin
      .from("cotizaciones")
      .update({ estado: "cerrada", updated_at: now } as never)
      .eq("id", actual.cotizacion_id);
  }

  await auditarOperacion(
    operacionId,
    "operacion_cerrada_completa",
    {
      fecha_pago_proveedor: actual.fecha_pago_proveedor,
      fecha_cobro_cliente: actual.fecha_cobro_cliente,
      cotizacion_id: actual.cotizacion_id,
      cotizacion_cerrada: !!actual.cotizacion_id,
    },
    usuarioId,
  );

  return { cerrada: true, estado: "cerrada" };
}

/**
 * Deja la operación en fase de cobro cuando termina físicamente y sincroniza
 * la cotización. Idempotente: no retrocede estados posteriores.
 */
export async function pasarACobroPendiente(operacionId: string, usuarioId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("operaciones")
    .update({ estado: "cobro_pendiente", updated_at: now } as never)
    .eq("id", operacionId)
    .in("estado", ["finalizada"])
    .is("deleted_at", null)
    .select("id, cotizacion_id");
  if (error) throw new Error(error.message);
  const row = ((rows ?? []) as Record<string, any>[])[0];
  if (!row) return { cambiada: false };

  if (row["cotizacion_id"]) {
    await supabaseAdmin
      .from("cotizaciones")
      .update({ estado: "cobro_pendiente", updated_at: now } as never)
      .eq("id", row["cotizacion_id"]);
  }
  await auditarOperacion(operacionId, "estado_cobro_pendiente", { automatico: true }, usuarioId);
  return { cambiada: true };
}
