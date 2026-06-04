export type EstadoOperativo = "disponible" | "en_ruta" | "mantenimiento" | "inactivo";

export const ESTADOS_OPERATIVOS: { value: EstadoOperativo; label: string; dot: string; bg: string; text: string }[] = [
  { value: "disponible",    label: "Disponible",    dot: "bg-emerald-500", bg: "bg-emerald-100", text: "text-emerald-800" },
  { value: "en_ruta",       label: "En ruta",       dot: "bg-blue-500",    bg: "bg-blue-100",    text: "text-blue-800" },
  { value: "mantenimiento", label: "Mantenimiento", dot: "bg-amber-500",   bg: "bg-amber-100",   text: "text-amber-800" },
  { value: "inactivo",      label: "Inactivo",      dot: "bg-zinc-400",    bg: "bg-zinc-200",    text: "text-zinc-700" },
];

export const estadoMeta = (e: string | null | undefined) =>
  ESTADOS_OPERATIVOS.find((x) => x.value === e) ?? ESTADOS_OPERATIVOS[0];

// License-class to truck-type compatibility.
// A1/A2/A3 → tracto, rígido, plataforma
// A4 → rígido, furgón
// B → furgón
const COMPAT: Record<string, string[]> = {
  A1: ["tracto", "rigido", "plataforma"],
  A2: ["tracto", "rigido", "plataforma"],
  A3: ["tracto", "rigido", "plataforma"],
  A4: ["rigido", "furgon"],
  B:  ["furgon"],
};

const normTipo = (t: string | null | undefined) => {
  if (!t) return "";
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export function licenseCovers(clase: string | null | undefined, tipoCamion: string | null | undefined): boolean {
  if (!clase || !tipoCamion) return true; // unknown → don't warn
  const c = clase.toUpperCase().trim();
  const allowed = COMPAT[c];
  if (!allowed) return true;
  return allowed.includes(normTipo(tipoCamion));
}
