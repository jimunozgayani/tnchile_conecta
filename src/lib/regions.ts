export const REGIONES_CHILE = [
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Atacama",
  "Coquimbo",
  "Valparaíso",
  "Metropolitana de Santiago",
  "Libertador General Bernardo O'Higgins",
  "Maule",
  "Ñuble",
  "Biobío",
  "La Araucanía",
  "Los Ríos",
  "Los Lagos",
  "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena",
] as const;

export const TIPOS_CAMION = ["Tracto", "Rígido", "Furgón", "Plataforma"] as const;
export const CLASES_LICENCIA = ["A1", "A2", "A3", "A4", "B"] as const;

export function diasHasta(fecha: string | null | undefined): number | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - hoy.getTime()) / 86400000);
}

export type EstadoVenc = "ok" | "warn" | "soon" | "danger" | "none";

export function estadoVencimiento(fecha: string | null | undefined): EstadoVenc {
  const d = diasHasta(fecha);
  if (d === null) return "none";
  if (d < 0) return "danger";      // vencido → rojo
  if (d <= 15) return "soon";      // ≤15 días → naranjo
  if (d <= 30) return "warn";      // ≤30 días → amarillo
  return "ok";
}
