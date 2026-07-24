import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CityCombobox } from "@/components/CityCombobox";
import { CalendarDays, Truck, Users } from "lucide-react";

export const Route = createFileRoute("/_app/operaciones-disponibilidad-semana")({
  head: () =>
    pageHead(
      "/operaciones-disponibilidad-semana",
      "Disponibilidad semanal · Operaciones TN Chile",
      "Panel semanal de operaciones TN Chile: gestiona la disponibilidad diaria, camión, ruta y tipo de carga de cada chofer.",
    ),
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: OpsWeekPage,
});

// ---------- Helpers ----------

type Estado = "disponible" | "no_disponible";
type Modalidad = "consolidado" | "rampla_completa" | null;

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"] as const;

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=sun..6=sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return toISODate(d);
  });
}

// ---------- Page ----------

function OpsWeekPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [truckFilter, setTruckFilter] = useState<string>("all");
  const [newNombre, setNewNombre] = useState("");
  const [newTipoCamionId, setNewTipoCamionId] = useState<string>("");
  const [newTipoCamionOtro, setNewTipoCamionOtro] = useState<string>("");
  const [newLugarId, setNewLugarId] = useState<string | null>(null);
  const [newLugarTexto, setNewLugarTexto] = useState<string | null>(null);
  const [newDestinoId, setNewDestinoId] = useState<string | null>(null);
  const [newDestinoTexto, setNewDestinoTexto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const monday = useMemo(() => startOfWeek(new Date()), []);
  const days = useMemo(() => weekDates(monday), [monday]);
  const todayISO = toISODate(new Date());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Drivers (both proveedor and operaciones origin)
  const driversQ = useQuery({
    queryKey: ["ops-week-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, nombre_completo, user_id, origen_registro, clase_licencia")
        .is("deleted_at", null)
        .in("origen_registro", ["proveedor", "operaciones"])
        .order("nombre_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Trucks (for the row-level camión dropdown + tipo lookup)
  const trucksQ = useQuery({
    queryKey: ["ops-week-trucks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trucks")
        .select("id, patente, tipo, user_id")
        .is("deleted_at", null)
        .order("patente");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Catalog of general truck types (independent of a specific vehicle)
  const tiposQ = useQuery({
    queryKey: ["tipos-camion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_camion")
        .select("id, nombre, orden")
        .eq("activo", true)
        .order("orden", { ascending: true, nullsFirst: false })
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
  const tipos = tiposQ.data ?? [];


  // Availability rows for current week (single-day rows only)
  const dispQ = useQuery({
    queryKey: ["ops-week-disp", days[0], days[6]],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilidad_chofer")
        .select(
          "id, driver_id, fecha_desde, fecha_hasta, estado, lugar_ciudad_id, lugar_texto, destino_ciudad_id, destino_texto, modalidad, truck_id, fuente, lugar:lugar_ciudad_id(nombre), destino:destino_ciudad_id(nombre), truck:truck_id(patente, tipo)",
        )
        .gte("fecha_desde", days[0])
        .lte("fecha_desde", days[6]);
      if (error) throw error;
      // client-side ensure single-day rows only
      return (data ?? []).filter((r: any) => r.fecha_desde === r.fecha_hasta);
    },
  });

  const drivers = driversQ.data ?? [];
  const trucks = trucksQ.data ?? [];
  const rows = dispQ.data ?? [];

  // Index rows by driver_id -> date -> row
  const rowsByDriverDate = useMemo(() => {
    const m = new Map<string, Map<string, any>>();
    for (const r of rows) {
      if (!m.has(r.driver_id)) m.set(r.driver_id, new Map());
      m.get(r.driver_id)!.set(r.fecha_desde, r);
    }
    return m;
  }, [rows]);

  // Row-level metadata per driver: pick from any row (first non-null); today's row wins
  const metaByDriver = useMemo(() => {
    const m = new Map<
      string,
      {
        truck_id: string | null;
        lugar_ciudad_id: string | null;
        lugar_texto: string | null;
        destino_ciudad_id: string | null;
        destino_texto: string | null;
        modalidad: Modalidad;
      }
    >();
    for (const d of drivers) {
      const byDate = rowsByDriverDate.get(d.id);
      const preferred =
        byDate?.get(todayISO) ??
        days.map((iso) => byDate?.get(iso)).find((r) => r) ??
        null;
      m.set(d.id, {
        truck_id: preferred?.truck_id ?? null,
        lugar_ciudad_id: preferred?.lugar_ciudad_id ?? null,
        lugar_texto: preferred?.lugar_texto ?? null,
        destino_ciudad_id: preferred?.destino_ciudad_id ?? null,
        destino_texto: preferred?.destino_texto ?? null,
        modalidad: (preferred?.modalidad ?? null) as Modalidad,
      });
    }
    return m;
  }, [drivers, rowsByDriverDate, days, todayISO]);

  const truckById = useMemo(() => {
    const m = new Map<string, any>();
    for (const t of trucks) m.set(t.id, t);
    return m;
  }, [trucks]);

  // Truck-type filter chips
  const typeChips = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of drivers) {
      const meta = metaByDriver.get(d.id);
      const t = meta?.truck_id ? truckById.get(meta.truck_id) : null;
      const tipo = t?.tipo ?? "sin_camion";
      counts.set(tipo, (counts.get(tipo) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [drivers, metaByDriver, truckById]);

  const filteredDrivers = useMemo(() => {
    if (truckFilter === "all") return drivers;
    return drivers.filter((d) => {
      const meta = metaByDriver.get(d.id);
      const t = meta?.truck_id ? truckById.get(meta.truck_id) : null;
      const tipo = t?.tipo ?? "sin_camion";
      return tipo === truckFilter;
    });
  }, [drivers, truckFilter, metaByDriver, truckById]);

  // Today's disponibles
  const todayAvailables = useMemo(() => {
    return drivers
      .map((d) => {
        const r = rowsByDriverDate.get(d.id)?.get(todayISO);
        if (!r || r.estado !== "disponible") return null;
        const t = r.truck_id ? truckById.get(r.truck_id) : null;
        return {
          id: d.id,
          nombre: d.nombre_completo,
          patente: t?.patente ?? null,
          tipo: t?.tipo ?? null,
          lugar: r.lugar?.nombre ?? r.lugar_texto ?? null,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      nombre: string;
      patente: string | null;
      tipo: string | null;
      lugar: string | null;
    }>;
  }, [drivers, rowsByDriverDate, todayISO, truckById]);

  // ---------- Mutations ----------

  const upsertDay = useCallback(
    async (
      driverId: string,
      date: string,
      patch: Record<string, any>,
      existing: any | null,
    ) => {
      const base = existing ?? {
        driver_id: driverId,
        fecha_desde: date,
        fecha_hasta: date,
        estado: "disponible" as Estado,
        fuente: "operaciones",
        created_by: userId,
      };
      const payload = {
        driver_id: driverId,
        fecha_desde: date,
        fecha_hasta: date,
        estado: base.estado,
        lugar_ciudad_id: base.lugar_ciudad_id ?? null,
        lugar_texto: base.lugar_texto ?? null,
        destino_ciudad_id: base.destino_ciudad_id ?? null,
        destino_texto: base.destino_texto ?? null,
        modalidad: base.modalidad ?? null,
        truck_id: base.truck_id ?? null,
        fuente: "operaciones",
        created_by: userId,
        ...patch,
      };
      const { error } = await supabase
        .from("disponibilidad_chofer")
        .upsert(payload, { onConflict: "driver_id,fecha_desde" });
      if (error) throw error;
    },
    [userId],
  );

  const cycleDay = async (driverId: string, date: string) => {
    const existing = rowsByDriverDate.get(driverId)?.get(date) ?? null;
    try {
      // 3-state initial (sin_confirmar -> disponible on first click), then toggle
      // disponible <-> no_disponible. We never delete rows here to preserve
      // historical availability data.
      if (!existing) {
        await upsertDay(driverId, date, { estado: "disponible" }, null);
      } else if (existing.estado === "disponible") {
        await upsertDay(driverId, date, { estado: "no_disponible" }, existing);
      } else {
        await upsertDay(driverId, date, { estado: "disponible" }, existing);
      }
      dispQ.refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Error al actualizar");
    }
  };

  const setRowMeta = async (
    driverId: string,
    patch: Record<string, any>,
  ) => {
    try {
      const byDate = rowsByDriverDate.get(driverId);
      // Update all 7 days. Preserve estado for existing rows; default 'disponible' for new.
      for (const date of days) {
        const existing = byDate?.get(date) ?? null;
        await upsertDay(driverId, date, patch, existing);
      }
      dispQ.refetch();
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    }
  };

  // ---------- Add occasional driver ----------

  const addDriver = async () => {
    const nombre = newNombre.trim();
    if (!nombre) {
      toast.error("Ingresa el nombre del chofer");
      return;
    }
    setSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from("drivers")
        .insert({
          nombre_completo: nombre,
          origen_registro: "operaciones",
          user_id: null as any,
          creado_por: userId,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      // Optional pre-fill: only create disp rows if the admin filled any of
      // truck/lugar/destino. Otherwise leave zero rows so the driver renders
      // as 7x "sin confirmar".
      const otroTrim = newTipoCamionOtro.trim();
      const hasTipo = !!newTipoCamionId || (newTipoCamionId === "__otro" && !!otroTrim);
      const hasMeta =
        hasTipo || !!newLugarId || !!newLugarTexto || !!newDestinoId || !!newDestinoTexto;
      if (hasMeta && inserted?.id) {
        for (const date of days) {
          await upsertDay(
            inserted.id,
            date,
            {
              estado: "disponible",
              tipo_camion_id: newTipoCamionId && newTipoCamionId !== "__otro" ? newTipoCamionId : null,
              tipo_camion_otro: newTipoCamionId === "__otro" ? (otroTrim || null) : null,
              lugar_ciudad_id: newLugarId,
              lugar_texto: newLugarTexto,
              destino_ciudad_id: newDestinoId,
              destino_texto: newDestinoTexto,
            },
            null,
          );
        }
      }

      toast.success(`Chofer "${nombre}" agregado`);
      setNewNombre("");
      setNewTipoCamionId("");
      setNewTipoCamionOtro("");
      setNewLugarId(null);
      setNewLugarTexto(null);
      setNewDestinoId(null);
      setNewDestinoTexto(null);
      driversQ.refetch();
      dispQ.refetch();
    } catch (e: any) {
      toast.error(`Error al agregar chofer: ${e.message ?? e}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render ----------


  const loading = driversQ.isLoading || trucksQ.isLoading || dispQ.isLoading;

  return (
    <div className="space-y-4 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-primary-dark">
            <CalendarDays className="h-6 w-6" /> Disponibilidad semanal
          </h1>
          <p className="text-sm text-muted-foreground">
            Semana del {days[0]} al {days[6]} · vista de operaciones. Cada
            click cicla el día: sin confirmar → disponible → no disponible.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <LegendDot color="bg-muted" label="Sin confirmar" />
          <LegendDot color="bg-emerald-500" label="Disponible" />
          <LegendDot color="bg-red-500" label="No disponible" />
        </div>
      </header>

      {/* Today banner */}
      <section
        aria-label="Choferes disponibles hoy"
        className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
          <Users className="h-4 w-4" /> Hoy disponibles: {todayAvailables.length}
        </div>
        {todayAvailables.length > 0 ? (
          <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2 md:grid-cols-3">
            {todayAvailables.map((a) => (
              <li key={a.id} className="text-emerald-900/90 dark:text-emerald-100/90">
                <span className="font-medium">{a.nombre}</span>
                {a.patente ? ` · ${a.patente}` : ""}
                {a.tipo ? ` (${a.tipo})` : ""}
                {a.lugar ? ` · ${a.lugar}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-100/70">
            Ningún chofer marcado como disponible para hoy.
          </p>
        )}
      </section>

      {/* Truck-type chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <Chip
          active={truckFilter === "all"}
          onClick={() => setTruckFilter("all")}
          label={`Todos · ${drivers.length}`}
        />
        {typeChips.map(([tipo, count]) => (
          <Chip
            key={tipo}
            active={truckFilter === tipo}
            onClick={() => setTruckFilter(tipo)}
            label={`${tipo === "sin_camion" ? "Sin camión" : tipo} · ${count}`}
          />
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      {!loading && (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2">Chofer</th>
                <th className="px-2 py-2">Camión</th>
                <th className="px-2 py-2">Lugar actual</th>
                <th className="px-2 py-2">Destino</th>
                <th className="px-2 py-2">Tipo carga</th>
                {days.map((d, i) => (
                  <th
                    key={d}
                    className={`px-1 py-2 text-center ${
                      d === todayISO ? "bg-primary/10 text-primary-dark" : ""
                    }`}
                  >
                    <div className="text-[10px]">{DAY_LABELS[i]}</div>
                    <div className="text-[10px] font-normal">
                      {d.slice(8, 10)}/{d.slice(5, 7)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((d) => {
                const meta = metaByDriver.get(d.id)!;
                const byDate = rowsByDriverDate.get(d.id);
                return (
                  <tr key={d.id} className="border-t align-top">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium">
                      <div>{d.nombre_completo}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {d.origen_registro === "operaciones" ? "Ocasional" : "Proveedor"}
                        {d.clase_licencia ? ` · Lic. ${d.clase_licencia}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 min-w-[140px]">
                      <select
                        value={meta.truck_id ?? ""}
                        onChange={(e) =>
                          setRowMeta(d.id, { truck_id: e.target.value || null })
                        }
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">— sin camión —</option>
                        {trucks.map((t: any) => (
                          <option key={t.id} value={t.id}>
                            {t.patente}
                            {t.tipo ? ` · ${t.tipo}` : ""}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 min-w-[160px]">
                      <CityCombobox
                        value={meta.lugar_ciudad_id}
                        freeText={meta.lugar_texto}
                        onChange={(id, txt) =>
                          setRowMeta(d.id, {
                            lugar_ciudad_id: id,
                            lugar_texto: txt,
                          })
                        }
                        placeholder="Lugar"
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[160px]">
                      <CityCombobox
                        value={meta.destino_ciudad_id}
                        freeText={meta.destino_texto}
                        onChange={(id, txt) =>
                          setRowMeta(d.id, {
                            destino_ciudad_id: id,
                            destino_texto: txt,
                          })
                        }
                        placeholder="Destino"
                      />
                    </td>
                    <td className="px-2 py-2 min-w-[130px]">
                      <select
                        value={meta.modalidad ?? ""}
                        onChange={(e) =>
                          setRowMeta(d.id, {
                            modalidad: (e.target.value || null) as Modalidad,
                          })
                        }
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs"
                      >
                        <option value="">sin especificar</option>
                        <option value="consolidado">Consolidando</option>
                        <option value="rampla_completa">Rampla completa</option>
                      </select>
                    </td>
                    {days.map((iso) => {
                      const r = byDate?.get(iso);
                      const state: "sin" | Estado = r
                        ? (r.estado as Estado)
                        : "sin";
                      const cls =
                        state === "disponible"
                          ? "bg-emerald-500 text-white hover:bg-emerald-600"
                          : state === "no_disponible"
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-muted text-muted-foreground hover:bg-muted/70";
                      const label =
                        state === "disponible"
                          ? "✓"
                          : state === "no_disponible"
                            ? "✕"
                            : "·";
                      return (
                        <td
                          key={iso}
                          className={`px-1 py-2 text-center ${
                            iso === todayISO ? "bg-primary/5" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => cycleDay(d.id, iso)}
                            aria-label={`${d.nombre_completo} ${iso}: ${state}`}
                            className={`min-h-[36px] min-w-[36px] rounded-md text-sm font-semibold transition ${cls}`}
                          >
                            {label}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {filteredDrivers.length === 0 && (
                <tr>
                  <td
                    colSpan={5 + 7}
                    className="px-3 py-8 text-center text-sm text-muted-foreground"
                  >
                    Sin choferes para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Agregar chofer ocasional */}
      <section
        aria-label="Agregar chofer"
        className="rounded-xl border bg-card p-4 shadow-sm"
      >
        <h2 className="mb-3 text-sm font-semibold text-primary-dark">
          Agregar chofer ocasional
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Los campos opcionales pre-llenan la semana como “disponible”. Si solo
          ingresas el nombre, el chofer aparecerá con los 7 días en “sin
          confirmar”.
        </p>
        <div className="grid gap-3 md:grid-cols-5">
          <input
            type="text"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            placeholder="Nombre completo *"
            className="rounded border border-input bg-background px-2 py-2 text-sm"
          />
          <div className="flex flex-col gap-2">
            <select
              value={newTipoCamionId}
              onChange={(e) => setNewTipoCamionId(e.target.value)}
              className="rounded border border-input bg-background px-2 py-2 text-sm"
            >
              <option value="">Tipo de camión (opcional)</option>
              {tipos.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
              <option value="__otro">Otro (especificar)</option>
            </select>
            {newTipoCamionId === "__otro" && (
              <input
                type="text"
                value={newTipoCamionOtro}
                onChange={(e) => setNewTipoCamionOtro(e.target.value)}
                placeholder="Especificar tipo"
                className="rounded border border-input bg-background px-2 py-2 text-sm"
              />
            )}
          </div>
          <CityCombobox
            value={newLugarId}
            freeText={newLugarTexto}
            onChange={(id, txt) => {
              setNewLugarId(id);
              setNewLugarTexto(txt);
            }}
            placeholder="Lugar (opcional)"
          />
          <CityCombobox
            value={newDestinoId}
            freeText={newDestinoTexto}
            onChange={(id, txt) => {
              setNewDestinoId(id);
              setNewDestinoTexto(txt);
            }}
            placeholder="Destino (opcional)"
          />
          <button
            type="button"
            onClick={addDriver}
            disabled={submitting || !newNombre.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Agregando…" : "Agregar chofer"}
          </button>
        </div>
      </section>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded ${color}`} /> {label}
    </span>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:border-primary"
      }`}
    >
      {label}
    </button>
  );
}
