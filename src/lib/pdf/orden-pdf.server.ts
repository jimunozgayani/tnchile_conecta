/**
 * Renderizador de OC/OV para el servidor, escrito con pdf-lib (JavaScript puro).
 * El runtime del backend no permite instanciar WebAssembly, por lo que
 * @react-pdf/renderer (fontkit/yoga wasm) no puede usarse aquí; esos templates
 * quedan reservados para el navegador.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  EMPRESA,
  LOGO_URL_ABS,
  fmtCLP,
  fmtFechaLarga,
  pagoLabel,
} from "@/components/pdf/empresa-datos";
import type { OrdenCompraData } from "@/components/pdf/OrdenCompraPDF";
import type { OrdenVentaData } from "@/components/pdf/OrdenVentaPDF";

const VERDE = rgb(0x2d / 255, 0x7a / 255, 0x45 / 255);
const VERDE_SUAVE = rgb(0xe8 / 255, 0xf5 / 255, 0xee / 255);
const GRIS = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const TINTA = rgb(0x1f / 255, 0x29 / 255, 0x37 / 255);
const BLANCO = rgb(1, 1, 1);
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

type Ctx = {
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
};

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
    width?: number;
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
  const lines = wrap(valor, c.font, size, colWidth - 82);
  lines.forEach((l, i) => {
    c.page.drawText(sane(l), {
      x: x + 82,
      y: c.y - i * 11,
      size,
      font: c.font,
      color: TINTA,
    });
  });
  c.y -= 11 * lines.length;
}

async function cargarLogo(pdf: PDFDocument) {
  const res = await fetch(LOGO_URL_ABS);
  if (!res.ok) throw new Error(`logo HTTP ${res.status}`);
  return pdf.embedPng(await res.arrayBuffer());
}

type OrdenComun = {
  titulo: string;
  documento: "orden de compra" | "orden de venta";
  contraparteTitulo: string;
  contraparte: [string, string][];
  folio: string;
  fecha: string | null;
  numero_operacion: number | null;
  tipo_pago: string | null;
  origen: string | null;
  destino: string | null;
  tipo_camion: string | null;
  descripcion_carga: string | null;
  chofer?: string[] | null;
  neto: number;
};

async function renderOrden(d: OrdenComun, conLogo: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.titulo} ${d.folio}`);
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
  text(c, d.titulo, { align: "right", size: 16, bold: true });
  c.y -= 13;
  text(c, "La logística la hacemos juntos.", { x: marcaX, size: 8, color: GRIS });
  text(c, `N° ${d.folio}`, { align: "right", size: 8, color: GRIS });
  c.y -= 11;
  text(c, `Fecha: ${fmtFechaLarga(d.fecha)}`, { align: "right", size: 8, color: GRIS });
  c.y -= 11;
  if (d.numero_operacion != null) {
    text(c, `Operación N° ${d.numero_operacion}`, { align: "right", size: 8, color: GRIS });
    c.y -= 11;
  }
  c.y -= 6;
  page.drawLine({
    start: { x: M, y: c.y },
    end: { x: RIGHT, y: c.y },
    thickness: 2,
    color: VERDE,
  });
  c.y -= 16;

  // ---- Emisor / contraparte en dos columnas
  const colW = (RIGHT - M - 18) / 2;
  const colRightX = M + colW + 18;
  const yInicio = c.y;
  text(c, "DE", { size: 9, bold: true, color: VERDE });
  c.y -= 12;
  const emisor: [string, string][] = [
    ["Razón social:", EMPRESA.razon_social],
    ["RUT:", EMPRESA.rut],
    ["Giro:", EMPRESA.giro],
    ["Dirección:", EMPRESA.direccion],
    ["Email:", EMPRESA.email],
  ];
  for (const [k, v] of emisor) fila(c, k, v, M, colW);
  const yIzq = c.y;

  c.y = yInicio;
  text(c, d.contraparteTitulo, { x: colRightX, size: 9, bold: true, color: VERDE });
  c.y -= 12;
  for (const [k, v] of d.contraparte) fila(c, k, v, colRightX, colW);
  c.y = Math.min(yIzq, c.y) - 16;

  // ---- Ruta
  const ruta = `${d.origen ?? "Origen no especificado"} - ${d.destino ?? "Destino no especificado"}`;
  for (const l of wrap(ruta, bold, 12, RIGHT - M)) {
    text(c, l, { size: 12, bold: true });
    c.y -= 15;
  }
  text(c, `Retiro en: ${d.origen ?? "No especificado"}`);
  c.y -= 12;
  text(c, `Entrega en: ${d.destino ?? "No especificado"}`);
  c.y -= 12;
  if (d.descripcion_carga) {
    for (const l of wrap(`Carga: ${d.descripcion_carga}`, font, 9, RIGHT - M)) {
      text(c, l);
      c.y -= 12;
    }
  }

  // ---- Chofer (solo OC)
  if (d.chofer && d.chofer.length > 0) {
    c.y -= 6;
    const alto = 7 + d.chofer.length * 11;
    page.drawRectangle({
      x: M,
      y: c.y - alto + 12,
      width: RIGHT - M,
      height: alto,
      color: VERDE_SUAVE,
    });
    c.y -= 2;
    for (const l of d.chofer) {
      text(c, l, { x: M + 6, size: 8.5 });
      c.y -= 11;
    }
    c.y -= 4;
  }

  // ---- Tabla de items
  c.y -= 10;
  const tablaTop = c.y + 10;
  const cols = [
    { label: "Descripción", w: 0.5, align: "left" as const },
    { label: "Cant.", w: 0.1, align: "right" as const },
    { label: "Precio unitario", w: 0.2, align: "right" as const },
    { label: "Total neto", w: 0.2, align: "right" as const },
  ];
  const totalW = RIGHT - M;
  const xs: number[] = [];
  let acc = M;
  for (const col of cols) {
    xs.push(acc);
    acc += col.w * totalW;
  }
  page.drawRectangle({ x: M, y: tablaTop - 16, width: totalW, height: 16, color: VERDE });
  cols.forEach((col, i) => {
    const size = 8.5;
    const x =
      col.align === "right" ? xs[i]! + col.w * totalW - 5 - bold.widthOfTextAtSize(col.label, size) : xs[i]! + 5;
    page.drawText(sane(col.label), { x, y: tablaTop - 11, size, font: bold, color: BLANCO });
  });
  const descripcion = [
    "Servicio de transporte de carga",
    d.tipo_camion ? `(${d.tipo_camion})` : null,
    `- ${ruta}`,
  ]
    .filter(Boolean)
    .join(" ");
  const descLines = wrap(descripcion, font, 8.5, cols[0]!.w * totalW - 10);
  const filaAlto = Math.max(16, descLines.length * 10 + 6);
  page.drawRectangle({
    x: M,
    y: tablaTop - 16 - filaAlto,
    width: totalW,
    height: filaAlto + 16,
    borderColor: BORDE,
    borderWidth: 1,
  });
  descLines.forEach((l, i) => {
    page.drawText(sane(l), { x: M + 5, y: tablaTop - 27 - i * 10, size: 8.5, font, color: TINTA });
  });
  const celdas = ["1", fmtCLP(d.neto), fmtCLP(d.neto)];
  celdas.forEach((v, idx) => {
    const i = idx + 1;
    const s = sane(v);
    const x = xs[i]! + cols[i]!.w * totalW - 5 - font.widthOfTextAtSize(s, 8.5);
    page.drawText(s, { x, y: tablaTop - 27, size: 8.5, font, color: TINTA });
  });
  c.y = tablaTop - 16 - filaAlto - 18;

  // ---- Totales
  const iva = Math.round(d.neto * 0.19);
  const totLabelX = RIGHT - 210;
  const linea = (label: string, valor: string, destacado = false) => {
    text(c, label, { x: totLabelX, size: destacado ? 11 : 9, bold: destacado, color: destacado ? VERDE : TINTA });
    text(c, valor, {
      align: "right",
      size: destacado ? 11 : 9,
      bold: destacado,
      color: destacado ? VERDE : TINTA,
    });
    c.y -= destacado ? 15 : 12;
  };
  linea("Neto", fmtCLP(d.neto));
  linea("IVA 19%", fmtCLP(iva));
  c.y -= 3;
  page.drawLine({
    start: { x: totLabelX, y: c.y + 10 },
    end: { x: RIGHT, y: c.y + 10 },
    thickness: 1,
    color: VERDE,
  });
  c.y -= 3;
  linea("TOTAL", fmtCLP(d.neto + iva), true);

  // ---- Condiciones
  c.y -= 10;
  text(c, "CONDICIONES", { size: 9, bold: true, color: VERDE });
  c.y -= 12;
  fila(c, "Forma de pago:", pagoLabel(d.tipo_pago), M, RIGHT - M);
  fila(c, "Vigencia:", "30 días desde la fecha de emisión", M, RIGHT - M);
  const nota = `Se sugiere indicar el N° ${d.folio} de esta ${d.documento} al realizar el pago, para facilitar la conciliación.`;
  const notaLines = wrap(nota, font, 8.5, RIGHT - M - 12);
  const notaAlto = notaLines.length * 11 + 8;
  c.y -= 6;
  page.drawRectangle({
    x: M,
    y: c.y - notaAlto + 12,
    width: RIGHT - M,
    height: notaAlto,
    color: VERDE_SUAVE,
  });
  c.y -= 2;
  for (const l of notaLines) {
    text(c, l, { x: M + 6, size: 8.5 });
    c.y -= 11;
  }

  // ---- Datos de facturación
  c.y -= 12;
  text(c, "DATOS DE FACTURACIÓN", { size: 9, bold: true, color: VERDE });
  c.y -= 12;
  const yFact = c.y;
  for (const [k, v] of [
    ["Razón social:", EMPRESA.razon_social],
    ["RUT:", EMPRESA.rut],
    ["Giro:", EMPRESA.giro],
    ["Dirección:", EMPRESA.direccion],
  ] as [string, string][])
    fila(c, k, v, M, colW);
  const yFactIzq = c.y;
  c.y = yFact;
  for (const [k, v] of [
    ["Banco:", EMPRESA.banco],
    ["Tipo cuenta:", EMPRESA.tipo_cuenta],
    ["N° cuenta:", EMPRESA.numero_cuenta],
    ["Email:", EMPRESA.email],
  ] as [string, string][])
    fila(c, k, v, colRightX, colW);
  c.y = Math.min(yFactIzq, c.y);

  // ---- Pie de página
  page.drawLine({
    start: { x: M, y: 46 },
    end: { x: RIGHT, y: 46 },
    thickness: 1,
    color: BORDE,
  });
  const pie = `${d.titulo.charAt(0)}${d.titulo.slice(1).toLowerCase()} emitida por ${EMPRESA.razon_social} (TN Chile). No constituye factura ni boleta electrónica.`;
  const pieS = sane(pie);
  page.drawText(pieS, {
    x: (A4.w - font.widthOfTextAtSize(pieS, 7.5)) / 2,
    y: 34,
    size: 7.5,
    font,
    color: GRIS,
  });
  const pag = "Página 1 de 1";
  page.drawText(pag, {
    x: (A4.w - font.widthOfTextAtSize(pag, 7.5)) / 2,
    y: 24,
    size: 7.5,
    font,
    color: GRIS,
  });

  return pdf.save();
}

export function renderOrdenCompra(d: OrdenCompraData, conLogo: boolean): Promise<Uint8Array> {
  const chofer = [
    `Chofer asignado: ${d.chofer_nombre ?? "Por confirmar"}${d.chofer_rut ? ` - RUT: ${d.chofer_rut}` : ""}${
      d.patente_principal ? ` - Patente: ${d.patente_principal}` : ""
    }`,
    ...(d.patente_secundaria ? [`+ Patente rampla/carro: ${d.patente_secundaria}`] : []),
  ];
  return renderOrden(
    {
      titulo: "ORDEN DE COMPRA",
      documento: "orden de compra",
      contraparteTitulo: "PROVEEDOR",
      contraparte: [
        ["Nombre:", d.proveedor_nombre ?? "No especificado"],
        ["RUT:", d.proveedor_rut ?? "No especificado"],
        ["Dirección:", d.proveedor_direccion ?? "No especificada"],
        ["Email:", d.proveedor_email ?? "No especificado"],
        ["Teléfono:", d.proveedor_telefono ?? "No especificado"],
        ["Forma pago:", pagoLabel(d.tipo_pago)],
      ],
      folio: d.folio,
      fecha: d.fecha,
      numero_operacion: d.numero_operacion,
      tipo_pago: d.tipo_pago,
      origen: d.origen,
      destino: d.destino,
      tipo_camion: d.tipo_camion,
      descripcion_carga: d.descripcion_carga,
      chofer,
      neto: Math.round(d.costo_clp ?? 0),
    },
    conLogo,
  );
}

export function renderOrdenVenta(d: OrdenVentaData, conLogo: boolean): Promise<Uint8Array> {
  return renderOrden(
    {
      titulo: "ORDEN DE VENTA",
      documento: "orden de venta",
      contraparteTitulo: "CLIENTE",
      contraparte: [
        ["Nombre:", d.cliente_nombre ?? "No especificado"],
        ["Empresa:", d.cliente_empresa ?? "No especificada"],
        ["RUT:", d.cliente_rut ?? "No especificado"],
        ["Email:", d.cliente_email ?? "No especificado"],
        ["Teléfono:", d.cliente_telefono ?? "No especificado"],
        ["Forma pago:", pagoLabel(d.tipo_pago)],
      ],
      folio: d.folio,
      fecha: d.fecha,
      numero_operacion: d.numero_operacion,
      tipo_pago: d.tipo_pago,
      origen: d.origen,
      destino: d.destino,
      tipo_camion: d.tipo_camion,
      descripcion_carga: d.descripcion_carga,
      neto: Math.round(d.precio_clp ?? 0),
    },
    conLogo,
  );
}
