import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Correo } from "@/lib/email/templates.server";

const BUCKET = "documentos-operacion";
const TTL = 3600;

export type TipoDoc = "oc" | "ov";
const TIPO_DB: Record<TipoDoc, "oc_proveedor" | "ov_cliente"> = {
  oc: "oc_proveedor",
  ov: "ov_cliente",
};

type Ctx = {
  operacion: Record<string, unknown>;
  cotizacion: Record<string, unknown> | null;
  propuesta: Record<string, unknown> | null;
  proveedorContacto: Record<string, unknown> | null;
  clienteContacto: Record<string, unknown> | null;
  chofer: Record<string, unknown> | null;
  tipoCamion: string | null;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : null;
  return n != null && Number.isFinite(n) ? n : null;
};

/** Reúne toda la data del Gate 3: operación → cotización → propuesta ganadora. */
async function cargarContexto(operacionId: string): Promise<Ctx> {
  const { data: op, error } = await supabaseAdmin
    .from("operaciones")
    .select(
      "id, numero_operacion, cotizacion_id, contacto_id, origen, destino, tipo_camion_id, tipo_camion_otro, descripcion_exacta, peso_kg, tipo_pago, precio_ofrecido_cliente_clp",
    )
    .eq("id", operacionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!op) throw new Error("Operación no encontrada.");
  const operacion = op as Record<string, unknown>;

  let cotizacion: Record<string, unknown> | null = null;
  if (str(operacion["cotizacion_id"])) {
    const { data } = await supabaseAdmin
      .from("cotizaciones")
      .select(
        "id, contacto_id, contacto_nombre, contacto_telefono, contacto_email, origen, tipo_pago, tipo_camion_id, tipo_camion_otro, precio_ofrecido_cliente_clp, propuesta_ganadora_id",
      )
      .eq("id", operacion["cotizacion_id"] as string)
      .maybeSingle();
    cotizacion = (data as Record<string, unknown> | null) ?? null;
  }

  let propuesta: Record<string, unknown> | null = null;
  const pgId = cotizacion ? str(cotizacion["propuesta_ganadora_id"]) : null;
  if (pgId) {
    const { data } = await supabaseAdmin
      .from("propuestas_proveedor")
      .select(
        "id, proveedor_contacto_id, proveedor_nombre, costo_clp, tipo_pago, tipo_camion_id, chofer_id, chofer_nombre_libre, chofer_rut_libre, patente_principal, patente_secundaria",
      )
      .eq("id", pgId)
      .maybeSingle();
    propuesta = (data as Record<string, unknown> | null) ?? null;
  }

  const contactoIds = [
    propuesta ? str(propuesta["proveedor_contacto_id"]) : null,
    str(operacion["contacto_id"]) ?? (cotizacion ? str(cotizacion["contacto_id"]) : null),
  ].filter((v): v is string => !!v);

  let contactos: Record<string, unknown>[] = [];
  if (contactoIds.length > 0) {
    const { data } = await supabaseAdmin
      .from("contactos")
      .select("id, nombre, empresa, rut, telefono, email, region")
      .in("id", contactoIds);
    contactos = (data as Record<string, unknown>[] | null) ?? [];
  }
  const byId = (id: string | null) =>
    (id ? contactos.find((c) => c["id"] === id) : null) ?? null;

  let chofer: Record<string, unknown> | null = null;
  const choferId = propuesta ? str(propuesta["chofer_id"]) : null;
  if (choferId) {
    const { data } = await supabaseAdmin
      .from("drivers")
      .select("id, nombre_completo, rut, celular, email")
      .eq("id", choferId)
      .maybeSingle();
    chofer = (data as Record<string, unknown> | null) ?? null;
  }

  const tcId =
    (propuesta ? str(propuesta["tipo_camion_id"]) : null) ??
    str(operacion["tipo_camion_id"]) ??
    (cotizacion ? str(cotizacion["tipo_camion_id"]) : null);
  let tipoCamion =
    str(operacion["tipo_camion_otro"]) ?? (cotizacion ? str(cotizacion["tipo_camion_otro"]) : null);
  if (tcId) {
    const { data } = await supabaseAdmin
      .from("tipos_camion")
      .select("nombre")
      .eq("id", tcId)
      .maybeSingle();
    const nombre = data ? str((data as Record<string, unknown>)["nombre"]) : null;
    if (nombre) tipoCamion = nombre;
  }

  return {
    operacion,
    cotizacion,
    propuesta,
    proveedorContacto: byId(propuesta ? str(propuesta["proveedor_contacto_id"]) : null),
    clienteContacto: byId(
      str(operacion["contacto_id"]) ?? (cotizacion ? str(cotizacion["contacto_id"]) : null),
    ),
    chofer,
    tipoCamion,
  };
}

/** Renderiza el PDF; si el logo remoto falla, reintenta sin logo. */
async function renderPDF(
  tipo: TipoDoc,
  ctx: Ctx,
  folio: string,
): Promise<{ buffer: Uint8Array; conLogo: boolean }> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { operacion: o, cotizacion: c, propuesta: p, tipoCamion } = ctx;
  const fecha = new Date().toISOString();
  const numero = numOrNull(o["numero_operacion"]);
  const origen = str(o["origen"]) ?? (c ? str(c["origen"]) : null);
  const destino = str(o["destino"]);
  const descripcion = str(o["descripcion_exacta"]);

  const build = async (conLogo: boolean) => {
    if (tipo === "oc") {
      const { OrdenCompraPDF } = await import("@/components/pdf/OrdenCompraPDF");
      const pc = ctx.proveedorContacto;
      const chofer = ctx.chofer;
      return renderToBuffer(
        <OrdenCompraPDF
          conLogo={conLogo}
          data={{
            folio,
            fecha,
            numero_operacion: numero,
            proveedor_nombre:
              (p ? str(p["proveedor_nombre"]) : null) ??
              (pc ? (str(pc["empresa"]) ?? str(pc["nombre"])) : null),
            proveedor_rut: pc ? str(pc["rut"]) : null,
            proveedor_email: pc ? str(pc["email"]) : null,
            proveedor_telefono: pc ? str(pc["telefono"]) : null,
            proveedor_direccion: pc ? str(pc["region"]) : null,
            tipo_pago: (p ? str(p["tipo_pago"]) : null) ?? str(o["tipo_pago"]),
            origen,
            destino,
            tipo_camion: tipoCamion,
            chofer_nombre: chofer
              ? str(chofer["nombre_completo"])
              : p
                ? str(p["chofer_nombre_libre"])
                : null,
            chofer_rut: chofer ? str(chofer["rut"]) : p ? str(p["chofer_rut_libre"]) : null,
            patente_principal: p ? str(p["patente_principal"]) : null,
            patente_secundaria: p ? str(p["patente_secundaria"]) : null,
            costo_clp: p ? numOrNull(p["costo_clp"]) : null,
            descripcion_carga: descripcion,
          }}
        />,
      );
    }
    const { OrdenVentaPDF } = await import("@/components/pdf/OrdenVentaPDF");
    const cc = ctx.clienteContacto;
    return renderToBuffer(
      <OrdenVentaPDF
        conLogo={conLogo}
        data={{
          folio,
          fecha,
          numero_operacion: numero,
          cliente_nombre: (c ? str(c["contacto_nombre"]) : null) ?? (cc ? str(cc["nombre"]) : null),
          cliente_empresa: cc ? str(cc["empresa"]) : null,
          cliente_rut: cc ? str(cc["rut"]) : null,
          cliente_email: (c ? str(c["contacto_email"]) : null) ?? (cc ? str(cc["email"]) : null),
          cliente_telefono:
            (c ? str(c["contacto_telefono"]) : null) ?? (cc ? str(cc["telefono"]) : null),
          tipo_pago: (c ? str(c["tipo_pago"]) : null) ?? str(o["tipo_pago"]),
          origen,
          destino,
          tipo_camion: tipoCamion,
          precio_clp:
            (c ? numOrNull(c["precio_ofrecido_cliente_clp"]) : null) ??
            numOrNull(o["precio_ofrecido_cliente_clp"]),
          descripcion_carga: descripcion,
        }}
      />,
    );
  };

  try {
    return { buffer: await build(true), conLogo: true };
  } catch (e) {
    console.error(
      "PDF con logo falló, reintentando sin logo:",
      e instanceof Error ? e.message : e,
    );
    return { buffer: await build(false), conLogo: false };
  }
}

/**
 * Genera la OC (proveedor) o la OV (cliente) de una operación: renderiza el PDF
 * en el servidor, lo sube a Storage, registra el folio y lo envía por correo.
 * Idempotente: si ya existe un documento de ese tipo, lo devuelve tal cual.
 */
export async function generarYSubirDocumento(
  operacionId: string,
  tipo: TipoDoc,
): Promise<{ folio: string; storagePath: string; conLogo: boolean; emailEnviado: boolean }> {
  const tipoDb = TIPO_DB[tipo];

  const { data: existente } = await supabaseAdmin
    .from("documentos_operacion")
    .select("folio, pdf_storage_path")
    .eq("operacion_id", operacionId)
    .eq("tipo", tipoDb)
    .maybeSingle();
  if (existente) {
    const e = existente as { folio: string; pdf_storage_path: string | null };
    return {
      folio: e.folio,
      storagePath: e.pdf_storage_path ?? "",
      conLogo: true,
      emailEnviado: false,
    };
  }

  const ctx = await cargarContexto(operacionId);

  const { data: folioData, error: fErr } = await supabaseAdmin.rpc("generar_folio", {
    p_tipo: tipo,
  } as never);
  if (fErr) throw new Error(`generar_folio: ${fErr.message}`);
  const folio = typeof folioData === "string" ? folioData : String(folioData);

  const { buffer, conLogo } = await renderPDF(tipo, ctx, folio);
  const storagePath = `${tipo}/${operacionId}/${folio}.pdf`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "application/pdf", upsert: true });
  if (upErr) throw new Error(`upload: ${upErr.message}`);

  const { data: doc, error: insErr } = await supabaseAdmin
    .from("documentos_operacion")
    .insert({
      operacion_id: operacionId,
      tipo: tipoDb,
      folio,
      pdf_storage_path: storagePath,
    } as never)
    .select("id")
    .single();
  if (insErr) throw new Error(`insert documentos_operacion: ${insErr.message}`);

  const { data: signed } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, TTL);
  const url = signed?.signedUrl ?? "";

  const { enviarCorreoSeguro } = await import("@/lib/email/send.server");
  const t = await import("@/lib/email/templates.server");
  const o = ctx.operacion;
  const numero = numOrNull(o["numero_operacion"]);
  const origen = str(o["origen"]) ?? (ctx.cotizacion ? str(ctx.cotizacion["origen"]) : null);
  const destino = str(o["destino"]);

  let destinatario: string | null;
  let correo: Correo;
  if (tipo === "oc") {
    const pc = ctx.proveedorContacto;
    destinatario = pc ? str(pc["email"]) : null;
    correo = t.ocGenerada({
      proveedor:
        (ctx.propuesta ? str(ctx.propuesta["proveedor_nombre"]) : null) ??
        (pc ? (str(pc["empresa"]) ?? str(pc["nombre"])) : null),
      folio,
      numero_operacion: numero,
      origen,
      destino,
      monto_neto: ctx.propuesta ? numOrNull(ctx.propuesta["costo_clp"]) : null,
      url,
    });
  } else {
    const cc = ctx.clienteContacto;
    destinatario =
      (ctx.cotizacion ? str(ctx.cotizacion["contacto_email"]) : null) ??
      (cc ? str(cc["email"]) : null);
    correo = t.ovGenerada({
      cliente:
        (ctx.cotizacion ? str(ctx.cotizacion["contacto_nombre"]) : null) ??
        (cc ? (str(cc["empresa"]) ?? str(cc["nombre"])) : null),
      folio,
      numero_operacion: numero,
      origen,
      destino,
      monto_neto:
        (ctx.cotizacion ? numOrNull(ctx.cotizacion["precio_ofrecido_cliente_clp"]) : null) ??
        numOrNull(o["precio_ofrecido_cliente_clp"]),
      url,
    });
  }

  const envio = await enviarCorreoSeguro(destinatario, correo);
  if (envio.ok) {
    await supabaseAdmin
      .from("documentos_operacion")
      .update({ enviado_at: new Date().toISOString() } as never)
      .eq("id", (doc as { id: string }).id);
  }

  return { folio, storagePath, conLogo, emailEnviado: envio.ok };
}

/** Best-effort: nunca interrumpe la autorización del Gate 3. */
export async function generarDocumentosSeguro(operacionId: string) {
  const resultados: {
    folio_oc: string | null;
    folio_ov: string | null;
    errores: string[];
    omitidos: string[];
  } = {
    folio_oc: null,
    folio_ov: null,
    errores: [],
    omitidos: [],
  };

  // La OV solo aplica a ventas a crédito; al contado no se emite ni se envía.
  const { data: opRow } = await supabaseAdmin
    .from("operaciones")
    .select("tipo_pago, cotizaciones(tipo_pago)")
    .eq("id", operacionId)
    .maybeSingle();
  const row = (opRow as Record<string, any> | null) ?? null;
  const tipoPago: string | null =
    (row?.["cotizaciones"]?.tipo_pago as string | null) ?? (row?.["tipo_pago"] as string | null) ?? null;
  const ovAplica = tipoPago !== "contado";

  for (const tipo of ["oc", "ov"] as TipoDoc[]) {
    if (tipo === "ov" && !ovAplica) {
      resultados.omitidos.push("ov: no aplica (pago al contado)");
      continue;
    }
    try {
      const r = await generarYSubirDocumento(operacionId, tipo);
      if (tipo === "oc") resultados.folio_oc = r.folio;
      else resultados.folio_ov = r.folio;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error desconocido";
      console.error(`generación ${tipo} falló`, msg);
      resultados.errores.push(`${tipo}: ${msg}`);
    }
  }
  return resultados;
}
