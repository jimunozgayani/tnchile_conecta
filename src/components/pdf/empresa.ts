/** Datos legales de la empresa y estilos compartidos por los PDF de OC/OV. */
import { StyleSheet } from "@react-pdf/renderer";

export const EMPRESA = {
  razon_social: "Trinico Inversiones SPA",
  rut: "77.867.614-1",
  giro: "Servicio de Logística",
  direccion: "13 Norte 853 Of. 803, Viña del Mar",
  email: "nicolas.garcia@tnchile.com",
  banco: "Banco Santander",
  tipo_cuenta: "Cuenta Corriente",
  numero_cuenta: "0-000-9417458-9",
} as const;

/** Al renderizar en el servidor no hay origen relativo: se usa la URL pública. */
export const LOGO_URL_ABS = "https://conecta.tnchile.com/tn-chile-logo.png";

export const VERDE = "#2D7A45";
export const VERDE_SUAVE = "#E8F5EE";
export const GRIS = "#6B7280";

export const fmtCLP = (n: number | null | undefined) =>
  `$ ${Math.round(n ?? 0).toLocaleString("es-CL")}`;

export const fmtFechaLarga = (iso?: string | null) => {
  const d = iso ? new Date(iso) : new Date();
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
};

export const PAGO_LABEL: Record<string, string> = {
  contado: "Contado",
  "15_dias": "15 días",
  "30_dias": "30 días",
  "50_50": "50% anticipo / 50% contra entrega",
};

export const pagoLabel = (v?: string | null) =>
  (v && (PAGO_LABEL[v] ?? v)) || "No especificado";

export const ordenStyles = StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 56, paddingHorizontal: 36, fontSize: 9, color: "#1F2937" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  marcaBloque: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 44, height: 44, borderRadius: 22, objectFit: "contain" },
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
  etiqueta: { width: 78, color: GRIS },
  valor: { flex: 1 },
  tituloServicio: { marginTop: 16, fontSize: 12, fontWeight: "bold" },
  rutaLinea: { marginTop: 4, fontSize: 9 },
  bloqueChofer: { marginTop: 12, backgroundColor: VERDE_SUAVE, padding: 7, fontSize: 8.5 },
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
  seccion: { marginTop: 16 },
  nota: { marginTop: 8, backgroundColor: VERDE_SUAVE, padding: 7, fontSize: 8.5 },
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
