import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CityCombobox } from "@/components/CityCombobox";
import { CamionLabel } from "@/components/CamionLabel";
import { Truck } from "lucide-react";

export type DayEstado = "sin_confirmar" | "disponible" | "no_disponible";

/** One merged row: ALWAYS one per driver, with or without availability data. */
export type DayRow = {
  driver_id: string;
  nombre: string;
  proveedor: string | null;
  proveedor_id: string | null;
  origen_registro: string | null;
  camion: any | null;
  disp: any | null;
  estado: DayEstado;
};


const NEXT_ESTADO: Record<DayEstado, DayEstado> = {
  sin_confirmar: "disponible",
  disponible: "no_disponible",
  no_disponible: "sin_confirmar",
};

const ESTADO_LABEL: Record<DayEstado, string> = {
  sin_confirmar: "Sin confirmar",
  disponible: "Disponible",
  no_disponible: "No disponible",
};

const ESTADO_CLASS: Record<DayEstado, string> = {
  sin_confirmar: "border-input bg-muted text-muted-foreground",
  disponible: "border-emerald-600 bg-emerald-600 text-white",
  no_disponible: "border-red-500 bg-red-500 text-white",
};

export function useDayRows(selected: string) {
  // Base list: EVERY driver, independent of the selected date.
  const driversQ = useQuery({
    queryKey: ["ops-day-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select(
          "id, nombre_completo, origen_registro, user_id, camion:camion_asignado_id(patente, tipo, tipo_camion:tipo_camion_id(nombre, requiere_acople), acoplado:acoplado_a_truck_id(patente))",
        )
        .is("deleted_at", null)
        .order("nombre_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  // No FK between drivers.user_id and profiles, so resolve names separately.
  const proveedoresQ = useQuery({
    queryKey: ["ops-day-proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, razon_social");
      if (error) throw error;
      return data ?? [];
    },
  });


  // Availability rows for the selected day only — merged client-side (LEFT JOIN).
  const dispQ = useQuery({
    queryKey: ["ops-day-disp", selected],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilidad_chofer")
        .select(
          "*, lugar:lugar_ciudad_id(nombre), destino:destino_ciudad_id(nombre), tipo_camion:tipo_camion_id(nombre), truck:truck_id(patente, tipo, tipo_camion:tipo_camion_id(nombre, requiere_acople), acoplado:acoplado_a_truck_id(patente))",
        )
        .eq("fecha_desde", selected)
        .eq("fecha_hasta", selected);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows: DayRow[] = useMemo(() => {
    const byDriver = new Map<string, any>();
    for (const r of dispQ.data ?? []) byDriver.set(r.driver_id, r);
    const provName = new Map<string, string | null>();
    for (const p of (proveedoresQ.data ?? []) as any[]) provName.set(p.id, p.razon_social ?? null);
    return ((driversQ.data ?? []) as any[]).map((d) => {
      const disp = byDriver.get(d.id) ?? null;
      return {
        driver_id: d.id,
        nombre: d.nombre_completo ?? "Chofer",
        proveedor: d.user_id ? (provName.get(d.user_id) ?? null) : null,
        proveedor_id: d.user_id ?? null,
        origen_registro: d.origen_registro ?? null,
        camion: disp?.truck ?? d.camion ?? null,
        disp,
        estado: (disp?.estado as DayEstado) ?? "sin_confirmar",
      };
    });
  }, [driversQ.data, dispQ.data, proveedoresQ.data]);

  return { rows, isLoading: driversQ.isLoading || dispQ.isLoading };
}

/** Effective truck type shown for a row (day entry wins over driver assignment). */
export function rowTipo(row: DayRow): string | null {
  return (
    row.disp?.tipo_camion?.nombre ??
    row.disp?.tipo_camion_otro ??
    row.camion?.tipo_camion?.nombre ??
    row.camion?.tipo ??
    null
  );
}

/** Current viewer: id + admin flag, used to gate "Cambiar camión asignado". */
function useViewer() {
  return useQuery({
    queryKey: ["ops-viewer"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { id: null as string | null, isAdmin: false };
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return {
        id: user.id,
        isAdmin: (roles ?? []).some((r: any) => r.role === "admin"),
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Modal picker that updates drivers.camion_asignado_id. */
function CamionPicker({
  row,
  isAdmin,
  onClose,
  onSaved,
}: {
  row: DayRow;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const trucksQ = useQuery({
    queryKey: ["ops-picker-trucks", row.proveedor_id, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("trucks")
        .select("id, patente, tipo, user_id, tipo_camion:tipo_camion_id(nombre, requiere_acople), acoplado:acoplado_a_truck_id(patente)")
        .is("deleted_at", null)
        .order("patente");
      if (!isAdmin && row.proveedor_id) q = q.eq("user_id", row.proveedor_id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const assign = async (truckId: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ camion_asignado_id: truckId })
        .eq("id", row.driver_id);
      if (error) throw error;
      toast.success(truckId ? "Camión asignado actualizado" : "Camión desasignado");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-label="Cambiar camión asignado"
    >
      <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-t-xl bg-card p-4 shadow-lg sm:rounded-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-primary-dark">
            Camión asignado · {row.nombre}
          </h3>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
            Cerrar
          </button>
        </div>

        {trucksQ.isLoading && <p className="text-sm text-muted-foreground">Cargando camiones…</p>}
        {!trucksQ.isLoading && (trucksQ.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay camiones disponibles para este chofer.
          </p>
        )}

        <ul className="space-y-2">
          {((trucksQ.data ?? []) as any[]).map((t) => (
            <li key={t.id}>
              <button
                type="button"
                disabled={saving}
                onClick={() => assign(t.id)}
                data-testid="picker-truck"
                className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition hover:bg-muted disabled:opacity-60"
              >
                <CamionLabel truck={t} />
                {row.camion?.patente === t.patente && (
                  <span className="text-[11px] font-semibold text-primary">Actual</span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {row.camion && (
          <button
            type="button"
            disabled={saving}
            onClick={() => assign(null)}
            className="mt-3 w-full rounded-md border px-3 py-2 text-sm text-muted-foreground"
          >
            Quitar camión asignado
          </button>
        )}
      </div>
    </div>
  );
}



export function DayDetailPanel({
  selected,
  readOnly,
  rows,
  isLoading,
  selectedDriverId,
  onSelectDriver,
}: {
  selected: string;
  readOnly: boolean;
  /** Already-filtered rows: the list and the map share the exact same array. */
  rows: DayRow[];
  isLoading: boolean;
  selectedDriverId?: string | null;
  onSelectDriver?: (driverId: string) => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState<DayRow | null>(null);
  const viewer = useViewer().data;



  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ops-day-disp"] });
    qc.invalidateQueries({ queryKey: ["ops-day-drivers"] });
    qc.invalidateQueries({ queryKey: ["ops-month-disp"] });
  };

  const save = async (row: DayRow, patch: Record<string, any>) => {
    if (readOnly) {
      toast.error("No se puede modificar una fecha pasada");
      return;
    }
    setBusy(row.driver_id);
    try {
      const { error } = await supabase.rpc("upsert_disponibilidad_dia", {
        _driver_id: row.driver_id,
        _fecha: selected,
        _estado: patch.estado ?? (row.estado === "sin_confirmar" ? "disponible" : row.estado),
        _lugar_ciudad_id: patch.lugar_ciudad_id ?? null,
        _lugar_texto: patch.lugar_texto ?? null,
        _destino_ciudad_id: patch.destino_ciudad_id ?? null,
        _destino_texto: patch.destino_texto ?? null,
        _modalidad: patch.modalidad ?? null,
        _tipo_camion_id: null,
        _tipo_camion_otro: null,
        _fuente: "operaciones",
      } as any);
      if (error) throw error;
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const cycle = async (row: DayRow) => {
    if (readOnly) {
      toast.error("No se puede modificar una fecha pasada");
      return;
    }
    const next = NEXT_ESTADO[row.estado];
    setBusy(row.driver_id);
    try {
      if (next === "sin_confirmar") {
        if (row.disp?.id) {
          const { error } = await supabase
            .from("disponibilidad_chofer")
            .delete()
            .eq("id", row.disp.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.rpc("upsert_disponibilidad_dia", {
          _driver_id: row.driver_id,
          _fecha: selected,
          _estado: next,
          _fuente: "operaciones",
        } as any);
        if (error) throw error;
      }
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(null);
    }
  };

  const visible = rows;

  const canAssign = (row: DayRow) =>
    !!viewer?.isAdmin || (!!viewer?.id && viewer.id === row.proveedor_id);

  return (
    <div className="space-y-3">
      {isLoading && <p className="text-sm text-muted-foreground">Cargando choferes…</p>}
      {!isLoading && visible.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay choferes para este filtro.</p>
      )}



      <ul className="space-y-2">
        {visible.map((row) => (
          <li
            key={row.driver_id}
            className="rounded-lg border bg-card p-3 shadow-sm"
            data-testid="day-row"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-[160px]">
                <div className="text-sm font-semibold text-foreground">{row.nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {row.proveedor ?? (row.origen_registro === "operaciones" ? "Ocasional" : "Sin proveedor")}
                </div>
                <div className="mt-1 flex items-start gap-2">
                  <CamionLabel truck={row.camion} />
                  {canAssign(row) && (
                    <button
                      type="button"
                      data-testid="change-truck"
                      title="Cambiar camión asignado"
                      aria-label={`Cambiar camión asignado de ${row.nombre}`}
                      onClick={() => setPicking(row)}
                      className="rounded border border-input p-1 text-muted-foreground transition hover:bg-muted"
                    >
                      <Truck className="h-4 w-4" />
                    </button>
                  )}
                </div>

              </div>
              <button
                type="button"
                onClick={() => cycle(row)}
                disabled={readOnly || busy === row.driver_id}
                className={`min-h-[44px] rounded-md border px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${ESTADO_CLASS[row.estado]}`}
              >
                {busy === row.driver_id ? "…" : ESTADO_LABEL[row.estado]}
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <CityCombobox
                value={row.disp?.lugar_ciudad_id ?? null}
                freeText={row.disp?.lugar_texto ?? null}
                onChange={(id, txt) =>
                  save(row, { estado: row.estado === "sin_confirmar" ? "disponible" : row.estado, lugar_ciudad_id: id, lugar_texto: txt })
                }
                placeholder="Lugar"
              />
              <CityCombobox
                value={row.disp?.destino_ciudad_id ?? null}
                freeText={row.disp?.destino_texto ?? null}
                onChange={(id, txt) =>
                  save(row, { estado: row.estado === "sin_confirmar" ? "disponible" : row.estado, destino_ciudad_id: id, destino_texto: txt })
                }
                placeholder="Destino"
              />
              <select
                value={row.disp?.modalidad ?? ""}
                disabled={readOnly || busy === row.driver_id}
                onChange={(e) =>
                  save(row, {
                    estado: row.estado === "sin_confirmar" ? "disponible" : row.estado,
                    modalidad: e.target.value || null,
                  })
                }
                className="rounded border border-input bg-background px-2 py-2 text-sm"
              >
                <option value="">Modalidad</option>
                <option value="consolidado">Consolidado</option>
                <option value="rampla_completa">Rampla completa</option>
              </select>
            </div>
          </li>
        ))}
      </ul>

      {picking && (
        <CamionPicker
          row={picking}
          isAdmin={!!viewer?.isAdmin}
          onClose={() => setPicking(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );

}
