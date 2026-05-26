export const REGIONES_CHILE = [
  "Arica",
  "Iquique",
  "Antofagasta",
  "Copiapó",
  "La Serena",
  "Valparaíso",
  "Rancagua",
  "Talca",
  "Chillán",
  "Concepción",
  "Temuco",
  "Valdivia",
  "Osorno",
  "Puerto Montt",
  "Coyhaique",
  "Punta Arenas",
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

export function estadoVencimiento(fecha: string | null | undefined): "ok" | "warn" | "danger" | "none" {
  const d = diasHasta(fecha);
  if (d === null) return "none";
  if (d < 15) return "danger";
  if (d <= 30) return "warn";
  return "ok";
}
