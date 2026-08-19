/**
 * Datos legales, colores y formateadores de los documentos (OC/OV/cotización).
 * Módulo puro: NO importa @react-pdf/renderer, para poder usarse también en el
 * renderizador del servidor (pdf-lib), donde WebAssembly no está disponible.
 */
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

export const pagoLabel = (v?: string | null) => (v && (PAGO_LABEL[v] ?? v)) || "No especificado";
