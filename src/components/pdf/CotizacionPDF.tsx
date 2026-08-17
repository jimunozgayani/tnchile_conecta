import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

/** Logo servido desde el mismo origen (evita problemas de CORS al renderizar). */
const LOGO_SRC = "/tn-chile-logo.png";

/** Colores corporativos TN Chile. */
const VERDE = "#2D7A45";
const VERDE_SUAVE = "#E8F5EE";
const GRIS = "#6B7280";

export type CotizacionPDFData = {
  id: string;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  origen: string | null;
  destinos: unknown;
  tipo_camion: string | null;
  modalidad: string | null;
  peso_kg: number | null;
  fecha_despacho: string | null;
  created_at: string | null;
  validez_hasta: string | null;
  precio_ofrecido_cliente_clp: number | null;
  lineas_servicio: unknown;
  tipo_pago: string | null;
  sobreestadia_horas_libres: number | null;
  sobreestadia_tarifa_hora_clp: number | null;
};

export type ContactoPDFData = {
  empresa: string | null;
  rut: string | null;
  telefono: string | null;
  email: string | null;
};

type LineaServicio = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
};

const fmtCLP = (n: number | null | undefined) =>
  `$ ${Math.round(n ?? 0).toLocaleString("es-CL")}`;

const PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  "15_dias": "15 días",
  "30_dias": "30 días",
  "50_50": "50% anticipo / 50% contra entrega",
};

const fmtFecha = (s: string | null | undefined) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

const primerDestino = (destinos: unknown): string => {
  if (Array.isArray(destinos) && destinos.length > 0) {
    const d = destinos[0];
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
      const o = d as Record<string, unknown>;
      const v = o["nombre"] ?? o["destino"] ?? o["ciudad"] ?? o["texto"];
      if (typeof v === "string") return v;
    }
  }
  return "No especificado";
};

const num = (v: unknown): number => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
};

/** Normaliza `lineas_servicio` (jsonb libre) a filas de tabla. */
const parseLineas = (raw: unknown, fallbackPrecio: number): LineaServicio[] => {
  if (Array.isArray(raw) && raw.length > 0) {
    const filas = raw
      .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
      .map((l) => {
        const cantidad = num(l["cantidad"] ?? l["qty"] ?? 1) || 1;
        const unitario = num(
          l["precio_unitario"] ?? l["precio_neto_clp"] ?? l["precio"] ?? l["valor"] ?? 0,
        );
        const total = num(l["total"]) || cantidad * unitario;
        const desc = l["descripcion"] ?? l["nombre"] ?? l["servicio"] ?? l["detalle"];
        return {
          descripcion: typeof desc === "string" && desc.trim() ? desc : "Servicio",
          cantidad,
          precio_unitario: unitario || (cantidad ? total / cantidad : total),
          total,
        };
      });
    if (filas.length > 0) return filas;
  }
  return [
    {
      descripcion: "Servicio de transporte",
      cantidad: 1,
      precio_unitario: fallbackPrecio,
      total: fallbackPrecio,
    },
  ];
};

const styles = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 56, paddingHorizontal: 36, fontSize: 9, color: "#1F2937" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  marca: { fontSize: 24, fontWeight: "bold", color: VERDE, letterSpacing: 1 },
  tagline: { fontSize: 8, fontStyle: "italic", color: GRIS, marginTop: 3 },
  docTitulo: { fontSize: 18, fontWeight: "bold", textAlign: "right" },
  docMeta: { fontSize: 8, color: GRIS, textAlign: "right", marginTop: 2 },
  divider: { borderBottomWidth: 2, borderBottomColor: VERDE, marginTop: 12, marginBottom: 14 },
  cols: { flexDirection: "row", gap: 18 },
  col: { flex: 1 },
  seccionTitulo: {
    fontSize: 9,
    fontWeight: "bold",
    color: VERDE,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  linea: { flexDirection: "row", marginBottom: 2 },
  etiqueta: { width: 74, color: GRIS },
  valor: { flex: 1 },
  tabla: { marginTop: 16, borderWidth: 1, borderColor: "#D1D5DB" },
  tablaHeader: { flexDirection: "row", backgroundColor: VERDE },
  th: { color: "#FFFFFF", fontWeight: "bold", padding: 5, fontSize: 8.5 },
  tr: { flexDirection: "row" },
  td: { padding: 5, fontSize: 8.5 },
  cDesc: { flex: 3 },
  cCant: { flex: 1, textAlign: "right" },
  cUnit: { flex: 1.4, textAlign: "right" },
  cTotal: { flex: 1.4, textAlign: "right" },
  totales: { marginTop: 12, alignItems: "flex-end" },
  totalLinea: { flexDirection: "row", width: 210, justifyContent: "space-between", marginBottom: 3 },
  totalFinal: {
    flexDirection: "row",
    width: 210,
    justifyContent: "space-between",
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: VERDE,
  },
  totalFinalTexto: { fontSize: 12, fontWeight: "bold", color: VERDE },
  nota: { marginTop: 10, backgroundColor: VERDE_SUAVE, padding: 7, fontSize: 8.5 },
  pago: { marginTop: 16 },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
  },
  footerTexto: { fontSize: 7.5, color: GRIS, textAlign: "center" },
});

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.linea}>
      <Text style={styles.etiqueta}>{etiqueta}</Text>
      <Text style={styles.valor}>{valor}</Text>
    </View>
  );
}

export function CotizacionPDF({
  cotizacion,
  contacto,
}: {
  cotizacion: CotizacionPDFData;
  contacto?: ContactoPDFData | null;
}) {
  const c = cotizacion;
  const folio = `COT-${c.id.slice(0, 8).toUpperCase()}`;
  const lineas = parseLineas(c.lineas_servicio, num(c.precio_ofrecido_cliente_clp));
  const subtotal = lineas.reduce((acc, l) => acc + l.total, 0);
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const sobreestadia = num(c.sobreestadia_tarifa_hora_clp) > 0;

  return (
    <Document title={`Cotización ${folio}`} author="TN Chile">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.marca}>TN CHILE</Text>
            <Text style={styles.tagline}>La logística la hacemos juntos.</Text>
          </View>
          <View>
            <Text style={styles.docTitulo}>COTIZACIÓN</Text>
            <Text style={styles.docMeta}>N° {folio}</Text>
            <Text style={styles.docMeta}>Fecha: {fmtFecha(c.created_at) ?? "—"}</Text>
            <Text style={styles.docMeta}>
              Válida hasta: {fmtFecha(c.validez_hasta) ?? "No especificada"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Cliente / Servicio */}
        <View style={styles.cols}>
          <View style={styles.col}>
            <Text style={styles.seccionTitulo}>CLIENTE</Text>
            <Fila etiqueta="Nombre:" valor={c.contacto_nombre ?? "No especificado"} />
            <Fila etiqueta="Empresa:" valor={contacto?.empresa ?? "No especificada"} />
            <Fila etiqueta="RUT:" valor={contacto?.rut ?? "No especificado"} />
            <Fila
              etiqueta="Teléfono:"
              valor={c.contacto_telefono ?? contacto?.telefono ?? "No especificado"}
            />
            <Fila etiqueta="Email:" valor={c.contacto_email ?? contacto?.email ?? "No especificado"} />
          </View>
          <View style={styles.col}>
            <Text style={styles.seccionTitulo}>DATOS DEL SERVICIO</Text>
            <Fila etiqueta="Origen:" valor={c.origen ?? "No especificado"} />
            <Fila etiqueta="Destino:" valor={primerDestino(c.destinos)} />
            <Fila etiqueta="Camión:" valor={c.tipo_camion ?? "No especificado"} />
            <Fila etiqueta="Modalidad:" valor={c.modalidad ?? "No especificada"} />
            <Fila
              etiqueta="Peso est.:"
              valor={c.peso_kg ? `${Number(c.peso_kg).toLocaleString("es-CL")} kg` : "No especificado"}
            />
            <Fila etiqueta="Despacho:" valor={fmtFecha(c.fecha_despacho) ?? "No especificada"} />
          </View>
        </View>

        {/* Tabla de líneas de servicio */}
        <View style={styles.tabla}>
          <View style={styles.tablaHeader}>
            <Text style={[styles.th, styles.cDesc]}>Descripción</Text>
            <Text style={[styles.th, styles.cCant]}>Cantidad</Text>
            <Text style={[styles.th, styles.cUnit]}>Precio unit.</Text>
            <Text style={[styles.th, styles.cTotal]}>Total</Text>
          </View>
          {lineas.map((l, i) => (
            <View
              key={`${l.descripcion}-${i}`}
              style={[styles.tr, { backgroundColor: i % 2 === 0 ? "#FFFFFF" : VERDE_SUAVE }]}
            >
              <Text style={[styles.td, styles.cDesc]}>{l.descripcion}</Text>
              <Text style={[styles.td, styles.cCant]}>{l.cantidad.toLocaleString("es-CL")}</Text>
              <Text style={[styles.td, styles.cUnit]}>{fmtCLP(l.precio_unitario)}</Text>
              <Text style={[styles.td, styles.cTotal]}>{fmtCLP(l.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totales */}
        <View style={styles.totales}>
          <View style={styles.totalLinea}>
            <Text>Subtotal (sin IVA)</Text>
            <Text>{fmtCLP(subtotal)}</Text>
          </View>
          <View style={styles.totalLinea}>
            <Text>IVA (19%)</Text>
            <Text>{fmtCLP(iva)}</Text>
          </View>
          <View style={styles.totalFinal}>
            <Text style={styles.totalFinalTexto}>TOTAL</Text>
            <Text style={styles.totalFinalTexto}>{fmtCLP(total)}</Text>
          </View>
          {c.tipo_pago ? (
            <Text style={{ marginTop: 5, color: GRIS }}>Condición de pago: {PAGO_LABEL[c.tipo_pago] ?? c.tipo_pago}</Text>
          ) : null}
        </View>

        {/* Sobreestadía */}
        {sobreestadia ? (
          <View style={styles.nota}>
            <Text>
              Sobreestadía: {num(c.sobreestadia_horas_libres)} horas libres, luego{" "}
              {fmtCLP(c.sobreestadia_tarifa_hora_clp)} / hora.
            </Text>
          </View>
        ) : null}

        {/* Datos de pago */}
        <View style={styles.pago}>
          <Text style={styles.seccionTitulo}>DATOS DE TRANSFERENCIA TN CHILE</Text>
          <Fila etiqueta="Banco:" valor="Banco Santander" />
          <Fila etiqueta="Cuenta cte.:" valor="0-000-9417458-9" />
          <Fila etiqueta="RUT:" valor="77.867.614-1" />
          <Fila etiqueta="Email:" valor="nicolas.garcia@tnchile.com" />
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerTexto}>
            Este documento es una cotización interna de TN Chile. No constituye factura ni boleta
            electrónica.
          </Text>
          <Text style={styles.footerTexto}>Válida por 30 días desde su emisión.</Text>
          <Text
            style={styles.footerTexto}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
