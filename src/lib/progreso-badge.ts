/**
 * Helpers compartidos (cliente + servidor) para los badges de progreso de
 * operación que se muestran en el tablero comercial y en la ficha.
 */

import type { ProgresoItem } from "./progreso-operaciones.server";

export type ProgresoInfo = ProgresoItem;

export const ESTADO_VIAJE_LABEL: Record<string, string> = {
  por_iniciar: "Por iniciar",
  cargando: "Cargando",
  en_ruta: "En ruta",
  descargando: "Descargando",
  entregado: "Entregado",
};

export type BadgeStyle = { label: string; className: string };

/**
 * Badge compacto para la tarjeta del Kanban: una sola etiqueta que resume
 * dónde está la operación en tiempo real.
 */
export function badgeProgreso(p: ProgresoInfo | null | undefined): BadgeStyle | null {
  if (!p || !p.operacion_estado) return null;
  const e = p.operacion_estado;
  switch (e) {
    case "lista_para_operar":
      return { label: "Operación creada", className: "bg-muted text-muted-foreground" };
    case "confirmada":
      return { label: "Chofer confirmado", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" };
    case "finalizada":
      return { label: "Entregado", className: "bg-emerald-500/15 text-emerald-700 dark:text-sky-300".replace("text-sky-300", "text-emerald-300") };
    case "en_operacion": {
      const v = p.estado_viaje;
      switch (v) {
        case "cargando":
          return { label: "Cargando", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" };
        case "en_ruta":
          return { label: "En ruta", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" };
        case "descargando":
          return { label: "Descargando", className: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" };
        case "entregado":
          return { label: "Entregado", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
        default:
          return { label: "En operación", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" };
      }
    }
    default:
      return null;
  }
}

/**
 * Etiqueta detallada para la ficha (drawer): combina el estado de operación
 * con el sub-estado del viaje, p.ej. "En operación · Descargando".
 */
export function detalleProgreso(p: ProgresoInfo | null | undefined): string | null {
  if (!p || !p.operacion_estado) return null;
  const e = p.operacion_estado;
  switch (e) {
    case "lista_para_operar":
      return "Operación creada";
    case "confirmada":
      return "Chofer confirmado";
    case "finalizada":
      return "Entregado";
    case "en_operacion": {
      const v = p.estado_viaje ? ESTADO_VIAJE_LABEL[p.estado_viaje] : null;
      return v ? `En operación · ${v}` : "En operación";
    }
    default:
      return null;
  }
}
