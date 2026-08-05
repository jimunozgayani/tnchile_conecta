export type RegionCap = { id: string; name: string };

export const REGIONES_CAPITALES: readonly RegionCap[] = [
  { id: "arica", name: "Arica y Parinacota" },
  { id: "tarapaca", name: "Tarapacá" },
  { id: "antofagasta", name: "Antofagasta" },
  { id: "atacama", name: "Atacama" },
  { id: "coquimbo", name: "Coquimbo" },
  { id: "valparaiso", name: "Valparaíso" },
  { id: "metropolitana", name: "Metropolitana de Santiago" },
  { id: "ohiggins", name: "Libertador Gral. B. O'Higgins" },
  { id: "maule", name: "Maule" },
  { id: "nuble", name: "Ñuble" },
  { id: "biobio", name: "Biobío" },
  { id: "araucania", name: "La Araucanía" },
  { id: "losrios", name: "Los Ríos" },
  { id: "loslagos", name: "Los Lagos" },
  { id: "aysen", name: "Aysén" },
  { id: "magallanes", name: "Magallanes" },
] as const;


export const TIPOS_CAMION_TARIFA = [
  { value: "tracto", label: "Tracto" },
  { value: "rigido", label: "Rígido" },
  { value: "plataforma", label: "Plataforma" },
  { value: "furgon", label: "Furgón" },
] as const;

export type TipoCamionTarifa = (typeof TIPOS_CAMION_TARIFA)[number]["value"];

export const fmtCLP = (n: number | null | undefined) =>
  n == null || isNaN(Number(n))
    ? "—"
    : new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
      }).format(Number(n));

export const fmtMiles = (n: number | null | undefined) =>
  n == null || isNaN(Number(n)) ? "" : new Intl.NumberFormat("es-CL").format(Number(n));

export const parseMiles = (s: string): number | null => {
  const cleaned = s.replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  return parseInt(cleaned, 10);
};
