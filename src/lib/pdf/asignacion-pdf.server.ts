/**
 * Renderizador del documento "Asignación de transporte" (pdf-lib, JavaScript
 * puro: el runtime del backend no permite instanciar WebAssembly).
 *
 * A diferencia de la OC/OV, este documento NO lleva precios, forma de pago ni
 * datos de facturación: es una hoja de coordinación operativa (chofer, patentes
 * y horarios) que se puede compartir con el cliente.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { EMPRESA, LOGO_URL_ABS, fmtFechaLarga } from "@/components/pdf/empresa-datos";

const VERDE = rgb(0x2d / 255, 0x7a / 255, 0x45 / 255);
const VERDE_SUAVE = rgb(0xe8 / 255, 0xf5 / 255, 0xee / 255);
const GRIS = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const TINTA = rgb(0x1f / 255, 0x29 / 255, 0x37 / 255);
const BORDE = rgb(0xd1 / 255, 0xd5 / 255, 0xdb / 255);

const A4 = { w: 595.28, h: 841.89 };
const M = 36;
const RIGHT = A4.w - M;

/** Helvetica es WinAnsi: se reemplaza lo que no está en esa codificación. */
const sane = (t: string) =>
  t
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2192/g, "->")
    .replace(/[^\x00-\xFF\u2013\u2014\u20AC\u2026]/g, "");

export type AsignacionData = {
  numero_operacion: number | null;
  fecha: string | null;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  cliente_telefono: string | null;
  cliente_email: string | null;
  origen: string | null;
  destino: string | null;
  tipo_camion: string | null;
  descripcion_carga: string | null;
  peso_kg: number | null;
  chofer_nombre: string | null;
  chofer_rut: string | null;
  chofer_celular: string | null;
  patente_principal: string | null;
  patente_secundaria: string | null;
  fecha_carga: string | null;
  carga_hora_desde: string | null;
  carga_hora_hasta: string | null;
  descarga_fecha: string | null;
  descarga_hora_desde: string | null;
  descarga_hora_hasta: string | null;
  descarga_notas: string | null;
};

type Ctx = { page: PDFPage; y: number; font: PDFFont; bold: PDFFont };

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sane(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(t, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

function text(
  c: Ctx,
  t: string,
  opts: {
    x?: number;
    size?: number;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    align?: "left" | "right";
  } = {},
) {
  const size = opts.size ?? 9;
  const font = opts.bold ? c.bold : c.font;
  const s = sane(t);
  const w = font.widthOfTextAtSize(s, size);
  const x = opts.align === "right" ? (opts.x ?? RIGHT) - w : (opts.x ?? M);
  c.page.drawText(s, { x, y: c.y, size, font, color: opts.color ?? TINTA });
}

function fila(c: Ctx, etiqueta: string, valor: string, x: number, colWidth: number) {
  const size = 8.5;
  text(c, etiqueta, { x, size, color: GRIS });
  const lines = wrap(valor, c.font, size, colWidth - 92);
  lines.forEach((l, i) => {
    c.page.drawText(sane(l), { x: x + 92, y: c.y - i * 11, size, font: c.font, color: TINTA });
  });
  c.y -= 11 * lines.length;
}

function seccion(c: Ctx, titulo: string) {
  c.y -= 10;
  text(c, titulo, { size: 9, bold: true, color: VERDE });
  c.y -= 13;
}

/** "09:30:00" -> "09:30"; nulos y basura se descartan. */
const hhmm = (v: string | null): string | null => {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim());
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : null;
};

const ventana = (desde: string | null, hasta: string | null): string | null => {
  const d = hhmm(desde);
  const h = hhmm(hasta);
  if (d && h) return `${d} a ${h} hrs`;
  if (d) return `desde las ${d} hrs`;
  if (h) return `hasta las ${h} hrs`;
  return null;
};

const fechaCorta = (v: string | null): string | null =>
  v ? fmtFechaLarga(v.length <= 10 ? `${v}T00:00:00Z` : v) : null;

async function cargarLogo(pdf: PDFDocument) {
  const res = await fetch(LOGO_URL_ABS);
  if (!res.ok) throw new Error(`logo HTTP ${res.status}`);
  return pdf.embedPng(await res.arrayBuffer());
}

export async function renderAsignacion(d: AsignacionData, conLogo: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    d.numero_operacion != null
      ? `Asignación de transporte - Operación N° ${d.numero_operacion}`
      : "Asignación de transporte",
  );
  pdf.setAuthor("TN Chile");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([A4.w, A4.h]);
  const c: Ctx = { page, y: A4.h - M - 12, font, bold };

  // ---- Encabezado
  let marcaX = M;
  if (conLogo) {
    const logo = await cargarLogo(pdf);
    const size = 60;
    page.drawImage(logo, { x: M, y: c.y - 46, width: size, height: size });
    marcaX = M + size + 10;
  }
  text(c, "ASIGNACIÓN DE TRANSPORTE", { align: "right", size: 15, bold: true });
  c.y -= 13;
  text(c, "La logística la hacemos juntos.", { x: marcaX, size: 8, color: GRIS });
  if (d.numero_operacion != null) {
    text(c, `Operación N° ${d.numero_operacion}`, { align: "right", size: 8, color: GRIS });
  }
  c.y -= 11;
  text(c, `Fecha de emisión: ${fmtFechaLarga(d.fecha)}`, { align: "right", size: 8, color: GRIS });
  c.y -= 11;
  text(c, EMPRESA.razon_social, { x: marcaX, size: 8, color: GRIS });
  c.y -= 14;
  page.drawLine({ start: { x: M, y: c.y }, end: { x: RIGHT, y: c.y }, thickness: 2, color: VERDE });
  c.y -= 18;

  const colW = RIGHT - M;

  // ---- Cliente
  seccion(c, "CLIENTE");
  fila(c, "Nombre:", d.cliente_nombre ?? "No especificado", M, colW);
  if (d.cliente_empresa) fila(c, "Empresa:", d.cliente_empresa, M, colW);
  fila(c, "Teléfono:", d.cliente_telefono ?? "No especificado", M, colW);
  fila(c, "Email:", d.cliente_email ?? "No especificado", M, colW);

  // ---- Ruta
  seccion(c, "RUTA");
  const ruta = `${d.origen ?? "Origen no especificado"} - ${d.destino ?? "Destino no especificado"}`;
  for (const l of wrap(ruta, bold, 12, colW)) {
    text(c, l, { size: 12, bold: true });
    c.y -= 15;
  }
  fila(c, "Retiro en:", d.origen ?? "No especificado", M, colW);
  fila(c, "Entrega en:", d.destino ?? "No especificado", M, colW);
  if (d.tipo_camion) fila(c, "Tipo de camión:", d.tipo_camion, M, colW);
  if (d.peso_kg != null) fila(c, "Peso:", `${Math.round(d.peso_kg).toLocaleString("es-CL")} kg`, M, colW);
  if (d.descripcion_carga) fila(c, "Carga:", d.descripcion_carga, M, colW);

  // ---- Chofer asignado (bloque destacado)
  const choferLineas = [
    `Chofer: ${d.chofer_nombre ?? "Por confirmar"}${d.chofer_rut ? `   RUT: ${d.chofer_rut}` : ""}`,
    // El teléfono del chofer no se incluye en la asignación (documento compartible con el cliente).
    `Patente tracto/camión: ${d.patente_principal ?? "Por confirmar"}`,
    ...(d.patente_secundaria ? [`Patente rampla/carro: ${d.patente_secundaria}`] : []),
  ];
  seccion(c, "CHOFER Y VEHÍCULO ASIGNADO");
  c.y -= 2;
  const altoChofer = 8 + choferLineas.length * 12;
  page.drawRectangle({
    x: M,
    y: c.y - altoChofer + 13,
    width: colW,
    height: altoChofer,
    color: VERDE_SUAVE,
  });
  c.y -= 2;
  for (const l of choferLineas) {
    text(c, l, { x: M + 8, size: 9 });
    c.y -= 12;
  }
  c.y -= 4;

  // ---- Horarios
  seccion(c, "HORARIOS");
  const carga = ventana(d.carga_hora_desde, d.carga_hora_hasta);
  const fCarga = fechaCorta(d.fecha_carga);
  fila(
    c,
    "Carga:",
    [carga, fCarga ? `el ${fCarga}` : null].filter(Boolean).join(" ") || "Por coordinar",
    M,
    colW,
  );
  const descarga = ventana(d.descarga_hora_desde, d.descarga_hora_hasta);
  const fDescarga = fechaCorta(d.descarga_fecha);
  fila(
    c,
    "Descarga:",
    [fDescarga, descarga].filter(Boolean).join(" · ") || "Por coordinar",
    M,
    colW,
  );

  // ---- Notas de descarga
  if (d.descarga_notas && d.descarga_notas.trim()) {
    seccion(c, "NOTAS DE DESCARGA");
    c.y -= 2;
    const lineas = wrap(d.descarga_notas.trim(), font, 8.5, colW - 16);
    const alto = lineas.length * 11 + 10;
    page.drawRectangle({
      x: M,
      y: c.y - alto + 13,
      width: colW,
      height: alto,
      color: VERDE_SUAVE,
      borderColor: VERDE,
      borderWidth: 0.5,
    });
    c.y -= 2;
    for (const l of lineas) {
      text(c, l, { x: M + 8, size: 8.5 });
      c.y -= 11;
    }
    c.y -= 4;
  }

  // ---- Contacto TN Chile
  seccion(c, "COORDINACIÓN TN CHILE");
  fila(c, "Email:", EMPRESA.email, M, colW);
  fila(c, "Dirección:", EMPRESA.direccion, M, colW);

  // ---- Pie de página
  page.drawLine({ start: { x: M, y: 46 }, end: { x: RIGHT, y: 46 }, thickness: 1, color: BORDE });
  const pie = `Documento de coordinación operativa emitido por ${EMPRESA.razon_social} (TN Chile). No constituye orden de compra, factura ni boleta electrónica.`;
  const pieLines = wrap(pie, font, 7.5, RIGHT - M);
  pieLines.forEach((l, i) => {
    const s = sane(l);
    page.drawText(s, {
      x: (A4.w - font.widthOfTextAtSize(s, 7.5)) / 2,
      y: 34 - i * 10,
      size: 7.5,
      font,
      color: GRIS,
    });
  });
  const pag = "Página 1 de 1";
  page.drawText(pag, {
    x: (A4.w - font.widthOfTextAtSize(pag, 7.5)) / 2,
    y: 34 - pieLines.length * 10,
    size: 7.5,
    font,
    color: GRIS,
  });

  return pdf.save();
}
