import { estadoVencimiento } from "@/lib/regions";

export type CompletenessInput = {
  profile: {
    razon_social?: string | null;
    rut_empresa?: string | null;
    nombre_contacto?: string | null;
    telefono?: string | null;
  } | null;
  trucks: Array<{
    soap_vencimiento?: string | null;
    permiso_circulacion_vencimiento?: string | null;
  }>;
  drivers: Array<unknown>;
  polizas?: Array<{
    fecha_vencimiento?: string | null;
    activa?: boolean | null;
  }>;
};

export type CompletenessItem = {
  label: string;
  weight: number;
  done: boolean;
};

export type CompletenessResult = {
  score: number;
  items: CompletenessItem[];
  missing: string[];
};

const notExpired = (f?: string | null) => {
  if (!f) return false;
  const e = estadoVencimiento(f);
  return e === "ok" || e === "soon" || e === "warn";
};

export function calcCompleteness(input: CompletenessInput): CompletenessResult {
  const p = input.profile ?? {};
  const basics = !!(p.razon_social && p.rut_empresa && p.nombre_contacto && p.telefono);
  const hasTruck = input.trucks.length > 0;
  const allSoap = hasTruck && input.trucks.every((t) => notExpired(t.soap_vencimiento));
  const allPermiso = hasTruck && input.trucks.every((t) => notExpired(t.permiso_circulacion_vencimiento));
  const hasDriver = input.drivers.length > 0;
  const poliza = (input.polizas ?? []).some(
    (po) => (po.activa ?? true) && notExpired(po.fecha_vencimiento),
  );

  const items: CompletenessItem[] = [
    { label: "Datos básicos del perfil (razón social, RUT, contacto, teléfono)", weight: 20, done: basics },
    { label: "Al menos 1 camión registrado", weight: 20, done: hasTruck },
    { label: "Todos los camiones con SOAP vigente", weight: 15, done: allSoap },
    { label: "Todos los camiones con Permiso de Circulación vigente", weight: 15, done: allPermiso },
    { label: "Al menos 1 chofer registrado", weight: 15, done: hasDriver },
    { label: "Póliza de seguro vigente cargada", weight: 15, done: poliza },
  ];
  const score = items.reduce((s, i) => s + (i.done ? i.weight : 0), 0);
  const missing = items.filter((i) => !i.done).map((i) => i.label);
  return { score, items, missing };
}

export function completionTone(score: number): "good" | "warn" | "bad" {
  if (score > 80) return "good";
  if (score >= 50) return "warn";
  return "bad";
}
