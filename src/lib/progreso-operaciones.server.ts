/**
 * Lógica de lectura del progreso de operación ligado a una cotización.
 * El `cotizacion.estado` se congela en "lista_para_operar" mientras la
 * operación avanza (lista_para_operar → confirmada → en_operación →
 * finalizada → cobro_pendiente), por lo que el tablero comercial necesita
 * consultar el estado real de la operación + el estado del viaje del chofer
 * para mostrar badges de progreso en vivo.
 */

export type ProgresoItem = {
  operacion_estado: string | null;
  estado_viaje: string | null;
};

export type ProgresoMap = Record<string, ProgresoItem>;

/** Estados de operación que cuentan como "en zona de operaciones" activa. */
export const ESTADOS_EN_OPERACION = ["confirmada", "en_operacion", "finalizada"];

export async function obtenerProgreso(cotizacionIds: string[]): Promise<ProgresoMap> {
  if (cotizacionIds.length === 0) return {};
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: ops, error } = await supabaseAdmin
    .from("operaciones")
    .select("id, cotizacion_id, estado, asignacion_id")
    .in("cotizacion_id", cotizacionIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const asignacionIds = [
    ...new Set(
      ((ops ?? []) as { asignacion_id: string | null }[])
        .map((o) => o.asignacion_id)
        .filter((v): v is string => !!v),
    ),
  ];

  const viajes: Record<string, string | null> = {};
  if (asignacionIds.length > 0) {
    const { data: asigs, error: e2 } = await supabaseAdmin
      .from("asignaciones")
      .select("id, estado_viaje")
      .in("id", asignacionIds);
    if (e2) throw new Error(e2.message);
    for (const a of (asigs ?? []) as { id: string; estado_viaje: string | null }[]) {
      viajes[a.id] = a.estado_viaje ?? null;
    }
  }

  const map: ProgresoMap = {};
  for (const o of (ops ?? []) as {
    id: string;
    cotizacion_id: string | null;
    estado: string | null;
    asignacion_id: string | null;
  }[]) {
    if (!o.cotizacion_id || map[o.cotizacion_id]) continue; // la más reciente activa gana
    map[o.cotizacion_id] = {
      operacion_estado: o.estado ?? null,
      estado_viaje: o.asignacion_id ? (viajes[o.asignacion_id] ?? null) : null,
    };
  }
  return map;
}
