/** Mapa de transiciones permitidas del pipeline comercial (compartido UI/servidor). */
export const TRANSICIONES: Record<string, string[]> = {
  nueva: ["cotizada"],
  pendiente: ["cotizada"],
  cotizada: ["aceptada", "en_revision", "rechazada"],
  en_revision: ["aceptada", "en_revision", "rechazada"],
  aceptada: ["lista_para_operar"],
  cobro_pendiente: ["cerrada"],
};

export const ESTADOS_OPERACIONES = [
  "lista_para_operar",
  "confirmada",
  "en_operacion",
  "finalizada",
];

export const COMERCIALISH = ["admin", "lider_cuenta", "comercial"];
export const ADMINISH = ["admin", "lider_cuenta"];

type Sb = { from: (t: string) => any };

export async function rolesDe(supabase: Sb, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return ((data ?? []) as { role: string }[]).map((r) => r.role);
}
