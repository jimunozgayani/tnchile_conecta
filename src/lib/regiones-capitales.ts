export type RegionCap = { name: string; code: string };

export const REGIONES_CAPITALES: RegionCap[] = [
  { name: "Arica", code: "XV" },
  { name: "Iquique", code: "I" },
  { name: "Antofagasta", code: "II" },
  { name: "Copiapó", code: "III" },
  { name: "La Serena", code: "IV" },
  { name: "Valparaíso", code: "V" },
  { name: "Santiago RM", code: "XIII" },
  { name: "Rancagua", code: "VI" },
  { name: "Talca", code: "VII" },
  { name: "Chillán", code: "XVI" },
  { name: "Concepción", code: "VIII" },
  { name: "Temuco", code: "IX" },
  { name: "Valdivia", code: "XIV" },
  { name: "Osorno", code: "X" },
  { name: "Puerto Montt", code: "X" },
  { name: "Coyhaique", code: "XI" },
  { name: "Punta Arenas", code: "XII" },
];

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
