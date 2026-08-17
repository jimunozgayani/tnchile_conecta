import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export async function auditCotizacion(
  registro_id: string,
  accion: string,
  datos_nuevos: Record<string, unknown>,
  usuario_id: string,
) {
  const { error } = await supabaseAdmin.from("audit_log").insert({
    tabla_nombre: "cotizaciones",
    registro_id,
    accion,
    datos_nuevos,
    usuario_id,
  } as never);
  if (error) console.error("audit_log insert failed", error.message);
}

/**
 * Crea (idempotente) la ficha de operación a partir de una cotización con el
 * cierre sellado. Compartida por el sellado comercial y por el Gate 3.
 */
export async function crearOperacionDesdeCotizacion(cotizacionId: string, userId: string) {
  const { data: cot, error: cErr } = await supabaseAdmin
    .from("cotizaciones")
    .select(
      "id, estado, contacto_id, origen, destinos, tipo_camion_id, tipo_camion_otro, peso_kg, largo_cm, ancho_cm, alto_cm, fecha_despacho, notas_admin, precio_ofrecido_cliente_clp, precio_maximo_proveedor_clp, tipo_pago, propuesta_ganadora_id, carga_hora_desde, carga_hora_hasta, descarga_fecha, descarga_hora_desde, descarga_hora_hasta, descarga_notas",
    )
    .eq("id", cotizacionId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!cot) throw new Error("Cotización no encontrada.");
  const c = cot as Record<string, unknown>;
  if (c["estado"] !== "lista_para_operar") {
    throw new Error("La cotización debe tener el cierre sellado (lista_para_operar).");
  }

  const { data: existente } = await supabaseAdmin
    .from("operaciones")
    .select("id, numero_operacion")
    .eq("cotizacion_id", cotizacionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (existente) {
    const e = existente as { id: string; numero_operacion: number };
    return { operacion_id: e.id, numero_operacion: e.numero_operacion, creada: false };
  }

  // Datos del chofer/camión adjudicados en la propuesta ganadora.
  let prop: {
    id: string;
    operador_id: string;
    chofer_id: string | null;
    chofer_nombre_libre: string | null;
    chofer_rut_libre: string | null;
    patente_principal: string | null;
    patente_secundaria: string | null;
  } | null = null;
  if (c["propuesta_ganadora_id"]) {
    const { data: p } = await supabaseAdmin
      .from("propuestas_proveedor")
      .select(
        "id, operador_id, chofer_id, chofer_nombre_libre, chofer_rut_libre, patente_principal, patente_secundaria",
      )
      .eq("id", c["propuesta_ganadora_id"] as string)
      .maybeSingle();
    prop = (p as typeof prop) ?? null;
  }


  const dims = [c["largo_cm"], c["ancho_cm"], c["alto_cm"]];
  const dimensiones = dims.some((v) => v != null)
    ? dims.map((v) => (v == null ? "?" : v)).join("×") + " cm"
    : null;
  const now = new Date().toISOString();

  const { data: nueva, error } = await supabaseAdmin
    .from("operaciones")
    .insert({
      cotizacion_id: cotizacionId,
      contacto_id: c["contacto_id"] ?? null,
      estado: "lista_para_operar",
      origen: c["origen"] ?? null,
      destino: primerDestino(c["destinos"]),
      tipo_camion_id: c["tipo_camion_id"] ?? null,
      tipo_camion_otro: c["tipo_camion_otro"] ?? null,
      peso_kg: c["peso_kg"] ?? null,
      dimensiones,
      fecha_tipo: c["fecha_despacho"] ? "exacta" : "sin_fecha",
      fecha_carga: c["fecha_despacho"] ?? null,
      notas_internas: c["notas_admin"] ?? null,
      precio_ofrecido_cliente_clp: c["precio_ofrecido_cliente_clp"] ?? null,
      precio_maximo_proveedor_clp: c["precio_maximo_proveedor_clp"] ?? null,
      tipo_pago: c["tipo_pago"] ?? null,
      pasada_a_operaciones_at: now,
      pasada_a_operaciones_por: userId,
      creado_por: userId,
    } as never)
    .select("id, numero_operacion")
    .single();
  if (error) throw new Error(error.message);

  const op = nueva as { id: string; numero_operacion: number };
  const { error: aErr } = await supabaseAdmin.from("audit_log").insert({
    tabla_nombre: "operaciones",
    registro_id: op.id,
    accion: "estado_lista_para_operar",
    datos_nuevos: { estado: "lista_para_operar", cotizacion_id: cotizacionId },
    usuario_id: userId,
  } as never);
  if (aErr) console.error("audit_log insert failed", aErr.message);

  return { operacion_id: op.id, numero_operacion: op.numero_operacion, creada: true };
}
