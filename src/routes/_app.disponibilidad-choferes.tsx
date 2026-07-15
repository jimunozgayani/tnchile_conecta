import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DisponibilidadChoferForm, type DispChoferRow } from "@/components/DisponibilidadChoferForm";
import { Users, Plus, Pencil, Trash2, CalendarDays, MapPin, ChevronDown, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/disponibilidad-choferes")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  component: DispChoferesPage,
});

function DispChoferesPage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
    })();
  }, []);

  const driversQuery = useQuery({
    enabled: !!userId,
    queryKey: ["mis-choferes-disp", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers").select("id, nombre_completo, rut, celular, clase_licencia")
        .eq("user_id", userId!).is("deleted_at", null).order("nombre_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const dispQuery = useQuery({
    enabled: !!userId,
    queryKey: ["disp-choferes-all", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilidad_chofer")
        .select("*, lugar:lugar_ciudad_id(nombre), destino:destino_ciudad_id(nombre), truck:truck_id(patente)")
        .order("fecha_desde", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const byDriver = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of dispQuery.data ?? []) {
      const arr = m.get(r.driver_id) ?? [];
      arr.push(r); m.set(r.driver_id, arr);
    }
    return m;
  }, [dispQuery.data]);

  const drivers = driversQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">Disponibilidad de mis choferes</h1>
        <p className="text-sm text-muted-foreground">
          Carga o edita la disponibilidad de cualquiera de tus choferes. Si el chofer también
          tiene su propio login, verá los mismos datos.
        </p>
      </div>

      {driversQuery.isLoading && <div className="text-sm text-muted-foreground">Cargando…</div>}
      {!driversQuery.isLoading && drivers.length === 0 && (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aún no tienes choferes registrados. Agrégalos primero en la sección "Choferes".
        </div>
      )}

      <div className="space-y-3">
        {drivers.map((d: any) => (
          <DriverCard key={d.id} driver={d} rows={byDriver.get(d.id) ?? []}
            proveedorUserId={userId} onChanged={() => dispQuery.refetch()} />
        ))}
      </div>
    </div>
  );
}

function DriverCard({ driver, rows, proveedorUserId, onChanged }: {
  driver: any; rows: any[]; proveedorUserId: string | null; onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<DispChoferRow> | null>(null);

  const nextRow = rows[0];

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta disponibilidad?")) return;
    const { error } = await supabase.from("disponibilidad_chofer").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada");
    onChanged();
  };

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Users className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">{driver.nombre_completo}</p>
            <p className="text-xs text-muted-foreground">
              {driver.rut ?? "sin RUT"}
              {driver.clase_licencia ? ` · Lic. ${driver.clase_licencia}` : ""}
              {rows.length > 0 ? ` · ${rows.length} registro${rows.length === 1 ? "" : "s"}` : " · sin disponibilidad"}
            </p>
          </div>
        </button>
        <button onClick={() => { setEditing(null); setFormOpen(true); setOpen(true); }}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-dark">
          <Plus className="h-3.5 w-3.5" /> Agregar
        </button>
      </header>

      {!open && nextRow && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${
            nextRow.estado === "disponible" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
          }`}>{nextRow.estado === "disponible" ? "Disponible" : "No disp."}</span>
          <span className="text-muted-foreground">{nextRow.fecha_desde} → {nextRow.fecha_hasta}</span>
          <span className="truncate text-muted-foreground">
            {(nextRow.lugar?.nombre ?? nextRow.lugar_texto ?? "—")} → {(nextRow.destino?.nombre ?? nextRow.destino_texto ?? "—")}
          </span>
        </div>
      )}

      {open && (
        <div className="space-y-3 p-4">
          {formOpen && (
            <DisponibilidadChoferForm
              driverId={driver.id}
              proveedorUserId={proveedorUserId}
              initial={editing ?? undefined}
              onSaved={() => { setFormOpen(false); setEditing(null); onChanged(); }}
              onCancel={() => { setFormOpen(false); setEditing(null); }}
            />
          )}

          {rows.length === 0 && !formOpen && (
            <p className="text-center text-xs text-muted-foreground">Sin disponibilidad cargada.</p>
          )}

          {rows.map((r) => (
            <div key={r.id} className={`rounded-lg border-l-4 border bg-background p-3 ${
              r.estado === "disponible" ? "border-l-emerald-500" : "border-l-red-500"
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {r.fecha_desde} → {r.fecha_hasta}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  r.estado === "disponible" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                }`}>{r.estado === "disponible" ? "Disponible" : "No disponible"}</span>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                <p><MapPin className="mr-1 inline h-3 w-3 text-primary" />
                  <span className="text-muted-foreground">Lugar:</span> {r.lugar?.nombre ?? r.lugar_texto ?? "—"}
                </p>
                <p><MapPin className="mr-1 inline h-3 w-3 text-primary" />
                  <span className="text-muted-foreground">Destino:</span> {r.destino?.nombre ?? r.destino_texto ?? "—"}
                </p>
                {r.modalidad && (
                  <p><span className="text-muted-foreground">Tipo:</span>{" "}
                    {r.modalidad === "consolidado" ? "Consolidado" : "Rampla completa"}</p>
                )}
                {r.truck?.patente && <p><span className="text-muted-foreground">Camión:</span> {r.truck.patente}</p>}
              </div>
              {r.notas && <p className="mt-1 text-xs text-muted-foreground">{r.notas}</p>}
              <div className="mt-2 flex gap-2">
                <button onClick={() => { setEditing(r); setFormOpen(true); }}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-accent">
                  <Pencil className="h-3 w-3" /> Editar
                </button>
                <button onClick={() => remove(r.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50">
                  <Trash2 className="h-3 w-3" /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
