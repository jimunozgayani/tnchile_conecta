import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CityCombobox } from "./CityCombobox";

export type DispChoferRow = {
  id?: string;
  driver_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  estado: "disponible" | "no_disponible";
  lugar_ciudad_id: string | null;
  lugar_texto: string | null;
  destino_ciudad_id: string | null;
  destino_texto: string | null;
  modalidad: "consolidado" | "rampla_completa" | null;
  truck_id: string | null;
  notas: string | null;
};

type Props = {
  driverId: string;
  proveedorUserId: string | null; // to fetch trucks; null = show none
  initial?: Partial<DispChoferRow> | null;
  onSaved: () => void;
  onCancel?: () => void;
};

const EMPTY: DispChoferRow = {
  driver_id: "",
  fecha_desde: "",
  fecha_hasta: "",
  estado: "disponible",
  lugar_ciudad_id: null,
  lugar_texto: null,
  destino_ciudad_id: null,
  destino_texto: null,
  modalidad: null,
  truck_id: null,
  notas: null,
};

export function DisponibilidadChoferForm({ driverId, proveedorUserId, initial, onSaved, onCancel }: Props) {
  const [row, setRow] = useState<DispChoferRow>({ ...EMPTY, ...(initial ?? {}), driver_id: driverId } as DispChoferRow);
  const [trucks, setTrucks] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!proveedorUserId) { setTrucks([]); return; }
    (async () => {
      const { data } = await supabase
        .from("trucks").select("id, patente, tipo")
        .eq("user_id", proveedorUserId).is("deleted_at", null).order("patente");
      setTrucks(data ?? []);
    })();
  }, [proveedorUserId]);

  const update = (patch: Partial<DispChoferRow>) => setRow((r) => ({ ...r, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row.fecha_desde || !row.fecha_hasta) { toast.error("Faltan fechas"); return; }
    if (row.fecha_hasta < row.fecha_desde) { toast.error("La fecha final debe ser posterior"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...row, driver_id: driverId, created_by: user?.id ?? null };
    const q = row.id
      ? supabase.from("disponibilidad_chofer").update(payload).eq("id", row.id)
      : supabase.from("disponibilidad_chofer").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(row.id ? "Disponibilidad actualizada" : "Disponibilidad guardada");
    onSaved();
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Desde</label>
          <input type="date" required value={row.fecha_desde}
            onChange={(e) => update({ fecha_desde: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Hasta</label>
          <input type="date" required value={row.fecha_hasta}
            onChange={(e) => update({ fecha_hasta: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Estado</label>
        <div className="grid grid-cols-2 gap-2">
          {(["disponible","no_disponible"] as const).map((v) => (
            <button key={v} type="button" onClick={() => update({ estado: v })}
              className={`min-h-[44px] rounded-md border px-3 py-2 text-sm font-semibold transition ${
                row.estado === v
                  ? v === "disponible"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-red-500 bg-red-500 text-white"
                  : "border-input bg-background hover:border-primary"
              }`}>
              {v === "disponible" ? "Disponible" : "No disponible"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Lugar actual</label>
          <CityCombobox
            value={row.lugar_ciudad_id}
            freeText={row.lugar_texto}
            onChange={(id, txt) => update({ lugar_ciudad_id: id, lugar_texto: txt })}
            placeholder="¿Dónde está?"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Destino</label>
          <CityCombobox
            value={row.destino_ciudad_id}
            freeText={row.destino_texto}
            onChange={(id, txt) => update({ destino_ciudad_id: id, destino_texto: txt })}
            placeholder="¿A dónde va?"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Tipo de carga</label>
        <div className="grid grid-cols-2 gap-2">
          {(["consolidado","rampla_completa"] as const).map((v) => (
            <button key={v} type="button" onClick={() => update({ modalidad: row.modalidad === v ? null : v })}
              className={`min-h-[44px] rounded-md border px-3 py-2 text-sm font-medium transition ${
                row.modalidad === v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:border-primary"
              }`}>
              {v === "consolidado" ? "Consolidado" : "Rampla completa"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
          Camión (opcional)
        </label>
        <select value={row.truck_id ?? ""} onChange={(e) => update({ truck_id: e.target.value || null })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">— Sin especificar —</option>
          {trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.patente}{t.tipo ? ` · ${t.tipo}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Notas</label>
        <textarea rows={2} value={row.notas ?? ""}
          onChange={(e) => update({ notas: e.target.value || null })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving}
          className="min-h-[44px] flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-dark disabled:opacity-60">
          {saving ? "Guardando…" : row.id ? "Actualizar" : "Guardar"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className="min-h-[44px] rounded-md border border-input bg-background px-4 py-2 text-sm">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
