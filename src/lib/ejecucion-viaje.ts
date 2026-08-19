/** Constantes compartidas del avance de viaje (cliente y servidor). */
export const ESTADOS_VIAJE = ["por_iniciar", "cargando", "en_ruta", "descargando", "entregado"] as const;

export const SIGUIENTE_VIAJE: Record<string, { estado: string; label: string }> = {
  por_iniciar: { estado: "cargando", label: "Empezar a cargar" },
  cargando: { estado: "en_ruta", label: "Salir a ruta" },
  en_ruta: { estado: "descargando", label: "Llegué, empezar a descargar" },
  descargando: { estado: "entregado", label: "Marcar como entregado" },
};

export const ESTADO_VIAJE_LABEL: Record<string, string> = {
  por_iniciar: "Por iniciar",
  cargando: "Cargando",
  en_ruta: "En ruta",
  descargando: "Descargando",
  entregado: "Entregado",
};

/** tipo de evento según el estado al que se avanza (igual que en /mis-viajes) */
export function tipoFotoPara(estado: string): "foto_carga" | "foto_descarga" | null {
  if (estado === "cargando") return "foto_carga";
  if (estado === "descargando") return "foto_descarga";
  return null;
}
