import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CityCombobox } from "@/components/CityCombobox";
import { CalendarDays } from "lucide-react";
import { MonthCalendar, toISODate, type DayData } from "@/components/MonthCalendar";
import { DayDetailPanel, useDayRows } from "@/components/DayDetailPanel";

export const Route = createFileRoute("/_app/operaciones-disponibilidad-semana")({
  head: () =>
    pageHead(
      "/operaciones-disponibilidad-semana",
      "Calendario de disponibilidad · Operaciones TN Chile",
      "Calendario mensual de operaciones TN Chile: revisa de un vistazo cuántos choferes están disponibles cada día y qué días faltan por cargar.",
    ),
  ssr: false,
  beforeLoad: requireAdmin,

  component: OpsAvailabilityPage,
});

const LONG_DATE = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function fromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function OpsAvailabilityPage() {
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);
  const qc = useQueryClient();


  const [userId, setUserId] = useState<string | null>(null);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState(todayISO);

  const [newNombre, setNewNombre] = useState("");
  const [newTipoCamionId, setNewTipoCamionId] = useState<string>("");
  const [newTipoCamionOtro, setNewTipoCamionOtro] = useState<string>("");
  const [newLugarId, setNewLugarId] = useState<string | null>(null);
  const [newLugarTexto, setNewLugarTexto] = useState<string | null>(null);
  const [newDestinoId, setNewDestinoId] = useState<string | null>(null);
  const [newDestinoTexto, setNewDestinoTexto] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const monthStart = useMemo(() => toISODate(new Date(year, month, 1)), [year, month]);
  const monthEnd = useMemo(() => toISODate(new Date(year, month + 1, 0)), [year, month]);
  // Grid can show days from the neighbouring months, so widen the window a week.
  const rangeStart = useMemo(() => toISODate(new Date(year, month, -6)), [year, month]);
  const rangeEnd = useMemo(() => toISODate(new Date(year, month + 1, 7)), [year, month]);

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

  // One aggregate query per month (never one per cell).
  const monthQ = useQuery({
    queryKey: ["ops-month-disp", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilidad_chofer")
        .select(
          "id, driver_id, fecha_desde, fecha_hasta, estado, tipo_camion_otro, lugar_texto, destino_texto, lugar:lugar_ciudad_id(nombre), destino:destino_ciudad_id(nombre), tipo_camion:tipo_camion_id(nombre), truck:truck_id(tipo, tipo_camion:tipo_camion_id(nombre)), driver:driver_id(nombre_completo)",
        )
        .gte("fecha_desde", rangeStart)
        .lte("fecha_desde", rangeEnd);
      if (error) throw error;
      return (data ?? []).filter((r: any) => r.fecha_desde === r.fecha_hasta);
    },
  });

  const dataByDate = useMemo(() => {
    const m = new Map<string, DayData>();
    for (const r of (monthQ.data ?? []) as any[]) {
      const iso = r.fecha_desde as string;
      if (!m.has(iso)) m.set(iso, { disponibles: [], otros: 0 });
      const bucket = m.get(iso)!;
      if (r.estado === "disponible") {
        bucket.disponibles.push({
          id: r.id,
          nombre: r.driver?.nombre_completo ?? "Chofer",
          tipo:
            r.tipo_camion?.nombre ??
            r.tipo_camion_otro ??
            r.truck?.tipo_camion?.nombre ??
            r.truck?.tipo ??
            null,
          lugar: r.lugar?.nombre ?? r.lugar_texto ?? null,
          destino: r.destino?.nombre ?? r.destino_texto ?? null,
        });
      } else {
        bucket.otros += 1;
      }
    }
    return m;
  }, [monthQ.data]);

  const monthTotals = useMemo(() => {
    let dias = 0;
    let cupos = 0;
    for (const [iso, d] of dataByDate) {
      if (iso < monthStart || iso > monthEnd) continue;
      if (d.disponibles.length > 0) dias += 1;
      cupos += d.disponibles.length;
    }
    return { dias, cupos };
  }, [dataByDate, monthStart, monthEnd]);

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelected(todayISO);
  };

  const selectDay = (iso: string) => {
    setSelected(iso);
    const d = fromISO(iso);
    if (d.getMonth() !== month || d.getFullYear() !== year) {
      setYear(d.getFullYear());
      setMonth(d.getMonth());
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

      if (inserted?.id && selected >= todayISO) {
        const otroTrim = newTipoCamionOtro.trim();
        const { error: rpcErr } = await supabase.rpc("upsert_disponibilidad_dia", {
          _driver_id: inserted.id,
          _fecha: selected,
          _estado: "disponible",
          _lugar_ciudad_id: newLugarId,
          _lugar_texto: newLugarTexto,
          _destino_ciudad_id: newDestinoId,
          _destino_texto: newDestinoTexto,
          _modalidad: null,
          _tipo_camion_id:
            newTipoCamionId && newTipoCamionId !== "__otro" ? newTipoCamionId : null,
          _tipo_camion_otro: newTipoCamionId === "__otro" ? otroTrim || null : null,
          _fuente: "operaciones",
        } as any);
        if (rpcErr) throw rpcErr;
      }

      toast.success(`Chofer "${nombre}" agregado`);
      setNewNombre("");
      setNewTipoCamionId("");
      setNewTipoCamionOtro("");
      setNewLugarId(null);
      setNewLugarTexto(null);
      setNewDestinoId(null);
      setNewDestinoTexto(null);
      qc.invalidateQueries({ queryKey: ["ops-month-disp"] });
      qc.invalidateQueries({ queryKey: ["ops-day-drivers"] });
      qc.invalidateQueries({ queryKey: ["ops-day-disp"] });
    } catch (e: any) {
      toast.error(`Error al agregar chofer: ${e.message ?? e}`);
    } finally {
      setSubmitting(false);
    }
  };

  const dayRows = useDayRows(selected);

  return (
    <div className="space-y-4 pb-24">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-primary-dark">
            <CalendarDays className="h-6 w-6" /> Disponibilidad
          </h1>
          <p className="text-sm text-muted-foreground">
            Calendario mensual de operaciones. El número en cada día indica los
            choferes marcados como disponibles; los días apagados aún no tienen
            datos cargados.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {monthTotals.dias} día(s) con disponibilidad · {monthTotals.cupos} registro(s)
        </div>
      </header>

      <MonthCalendar
        year={year}
        month={month}
        selected={selected}
        today={todayISO}
        dataByDate={dataByDate}
        onSelect={selectDay}
        onMonthChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
        onToday={goToday}
      />

      {monthQ.isLoading && (
        <p className="text-sm text-muted-foreground">Cargando calendario…</p>
      )}

      {/* Selected day — detail panel: EVERY driver, with or without data */}
      <section aria-label="Día seleccionado" className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-bold text-primary-dark">
          {capitalize(LONG_DATE.format(fromISO(selected)))}
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">
          {dayRows.rows.filter((r) => r.estado === "disponible").length} disponible(s) ·{" "}
          {dayRows.rows.filter((r) => r.estado === "sin_confirmar").length} sin confirmar
          {selected < todayISO ? " · fecha pasada (solo lectura)" : ""}
        </p>
        <DayDetailPanel
          selected={selected}
          readOnly={selected < todayISO}
          rows={dayRows.rows}
          isLoading={dayRows.isLoading}
        />
      </section>


      {/* Agregar chofer ocasional */}
      <section aria-label="Agregar chofer" className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-primary-dark">
          Agregar chofer ocasional
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          El chofer se marca como “disponible” en el día seleccionado. Los demás
          campos son opcionales.
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
