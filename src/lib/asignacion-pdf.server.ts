/**
 * Generación y cacheo del documento "Asignación de transporte" de una operación.
 * Se genera de forma diferida (al primer pedido de descarga, no en el Gate 3)
 * porque los horarios pueden seguir ajustándose después de autorizar.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AsignacionData } from "@/lib/pdf/asignacion-pdf.server";

const BUCKET = "documentos-operacion";
const TTL = 3600;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : null;
  return n != null && Number.isFinite(n) ? n : null;
};

const rutaStorage = (operacionId: string) => `asignacion/${operacionId}/asignacion.pdf`;

/** Reúne la data operativa: operación → cotización → contacto cliente → chofer. */
async function cargarDatos(operacionId: string): Promise<{
  datos: AsignacionData;
  actualizadaEn: string | null;
}> {
  const { data: op, error } = await supabaseAdmin
    .from("operaciones")
    .select(
      "id, numero_operacion, updated_at, cotizacion_id, contacto_id, origen, destino, peso_kg, descripcion_exacta, tipo_camion_id, tipo_camion_otro, chofer_id, chofer_nombre_libre, chofer_rut_libre, patente_principal, patente_secundaria, fecha_carga, carga_hora_desde, carga_hora_hasta, descarga_fecha, descarga_hora_desde, descarga_hora_hasta, descarga_notas",
    )
    .eq("id", operacionId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!op) throw new Error("Operación no encontrada.");
  const o = op as Record<string, unknown>;

  let cot: Record<string, unknown> | null = null;
  if (str(o["cotizacion_id"])) {
    const { data } = await supabaseAdmin
      .from("cotizaciones")
      .select(
        "id, contacto_id, contacto_nombre, contacto_telefono, contacto_email, origen, tipo_camion_id, tipo_camion_otro, updated_at",
      )
      .eq("id", o["cotizacion_id"] as string)
      .maybeSingle();
    cot = (data as Record<string, unknown> | null) ?? null;
  }

  const contactoId = str(o["contacto_id"]) ?? (cot ? str(cot["contacto_id"]) : null);
  let contacto: Record<string, unknown> | null = null;
  if (contactoId) {
    const { data } = await supabaseAdmin
      .from("contactos")
      .select("id, nombre, empresa, telefono, email")
      .eq("id", contactoId)
      .maybeSingle();
    contacto = (data as Record<string, unknown> | null) ?? null;
  }

  let chofer: Record<string, unknown> | null = null;
  if (str(o["chofer_id"])) {
    const { data } = await supabaseAdmin
      .from("drivers")
      .select("id, nombre_completo, rut, celular")
      .eq("id", o["chofer_id"] as string)
      .maybeSingle();
    chofer = (data as Record<string, unknown> | null) ?? null;
  }

  // Tipo de camión: catálogo → "otro" → texto heredado de la cotización.
  const tcId = str(o["tipo_camion_id"]) ?? (cot ? str(cot["tipo_camion_id"]) : null);
  let tipoCamion =
    str(o["tipo_camion_otro"]) ?? (cot ? str(cot["tipo_camion_otro"]) : null);
  if (tcId) {
    const { data } = await supabaseAdmin
      .from("tipos_camion")
      .select("nombre")
      .eq("id", tcId)
      .maybeSingle();
    const nombre = data ? str((data as Record<string, unknown>)["nombre"]) : null;
    if (nombre) tipoCamion = nombre;
  }

  const datos: AsignacionData = {
    numero_operacion: numOrNull(o["numero_operacion"]),
    fecha: new Date().toISOString(),
    cliente_nombre:
      (cot ? str(cot["contacto_nombre"]) : null) ?? (contacto ? str(contacto["nombre"]) : null),
    cliente_empresa: contacto ? str(contacto["empresa"]) : null,
    cliente_telefono:
      (cot ? str(cot["contacto_telefono"]) : null) ?? (contacto ? str(contacto["telefono"]) : null),
    cliente_email:
      (cot ? str(cot["contacto_email"]) : null) ?? (contacto ? str(contacto["email"]) : null),
    origen: str(o["origen"]) ?? (cot ? str(cot["origen"]) : null),
    destino: str(o["destino"]),
    tipo_camion: tipoCamion,
    descripcion_carga: str(o["descripcion_exacta"]),
    peso_kg: numOrNull(o["peso_kg"]),
    chofer_nombre: chofer ? str(chofer["nombre_completo"]) : str(o["chofer_nombre_libre"]),
    chofer_rut: chofer ? str(chofer["rut"]) : str(o["chofer_rut_libre"]),
    chofer_celular: chofer ? str(chofer["celular"]) : null,
    patente_principal: str(o["patente_principal"]),
    patente_secundaria: str(o["patente_secundaria"]),
    fecha_carga: str(o["fecha_carga"]),
    carga_hora_desde: str(o["carga_hora_desde"]),
    carga_hora_hasta: str(o["carga_hora_hasta"]),
    descarga_fecha: str(o["descarga_fecha"]),
    descarga_hora_desde: str(o["descarga_hora_desde"]),
    descarga_hora_hasta: str(o["descarga_hora_hasta"]),
    descarga_notas: str(o["descarga_notas"]),
  };

  // La operación se toca en cada edición de horarios; la cotización aporta los
  // datos del cliente, así que la marca más reciente de ambas define frescura.
  const marcas = [str(o["updated_at"]), cot ? str(cot["updated_at"]) : null].filter(
    (v): v is string => !!v,
  );
  const actualizadaEn = marcas.sort().at(-1) ?? null;

  return { datos, actualizadaEn };
}

/** Fecha de creación del PDF ya almacenado, si existe. */
async function pdfCacheado(operacionId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(`asignacion/${operacionId}`, { limit: 10 });
  const file = ((data ?? []) as Record<string, any>[]).find((f) => f["name"] === "asignacion.pdf");
  if (!file) return null;
  return (file["updated_at"] as string | null) ?? (file["created_at"] as string | null) ?? null;
}

/**
 * Devuelve una URL firmada (1 h) del PDF de asignación. Reutiliza el archivo ya
 * generado y sólo lo vuelve a renderizar si la operación/cotización cambió
 * después de la última generación (o si se fuerza).
 */
export async function obtenerAsignacionPDF(
  operacionId: string,
  forzar = false,
): Promise<{ url: string; storagePath: string; regenerado: boolean }> {
  const storagePath = rutaStorage(operacionId);
  const generadoEn = await pdfCacheado(operacionId);
  const { datos, actualizadaEn } = await cargarDatos(operacionId);

  const vencido =
    !generadoEn ||
    (!!actualizadaEn && new Date(actualizadaEn).getTime() > new Date(generadoEn).getTime());

  let regenerado = false;
  if (forzar || vencido) {
    const { renderAsignacion } = await import("@/lib/pdf/asignacion-pdf.server");
    let buffer: Uint8Array;
    try {
      buffer = await renderAsignacion(datos, true);
    } catch (e) {
      console.error("Asignación con logo falló, reintentando sin logo:", e instanceof Error ? e.message : e);
      buffer = await renderAsignacion(datos, false);
    }
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);
    regenerado = true;
  }

  const { data: signed, error: sErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, TTL);
  if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "No se pudo firmar el enlace.");

  return { url: signed.signedUrl, storagePath, regenerado };
}
