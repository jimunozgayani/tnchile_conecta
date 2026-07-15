import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DisponibilidadChoferForm, type DispChoferRow } from "@/components/DisponibilidadChoferForm";
import { CalendarDays, Lock, Pencil, Trash2, Plus, MapPin } from "lucide-react";

export const Route = createFileRoute("/_app/mi-disponibilidad-chofer")({
  head: () => pageHead("/mi-disponibilidad-chofer", "Mi disponibilidad · Portal Choferes TN Chile", "Marca los días que estás disponible o no, tu lugar actual, destino, modalidad y camión para recibir asignaciones de TN Chile."),
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  component: MiDisponibilidadChofer,
});

function MiDisponibilidadChofer() {
  const [userId, setUserId] = useState<string | null>(null);
  const [perfil, setPerfil] = useState<any>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partial<DispChoferRow> | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: cp } = await supabase
        .from("chofer_perfiles").select("*").eq("user_id", user.id).maybeSingle();
      setPerfil(cp);
      if (cp?.estado_validacion === "aprobado" && cp.proveedor_id && cp.rut) {
        // match a drivers row by rut (normalized) + proveedor
        const norm = cp.rut.replace(/[^0-9kK]/g, "").toLowerCase();
        const { data: drs } = await supabase
          .from("drivers").select("id, rut").eq("user_id", cp.proveedor_id).is("deleted_at", null);
        const match = (drs ?? []).find(
          (d: any) => (d.rut ?? "").replace(/[^0-9kK]/g, "").toLowerCase() === norm
        );
        setDriverId(match?.id ?? null);
      }
    })();
  }, []);

  const dispQuery = useQuery({
    enabled: !!driverId,
    queryKey: ["mi-disp-chofer", driverId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disponibilidad_chofer")
        .select("*, lugar:lugar_ciudad_id(nombre), destino:destino_ciudad_id(nombre), truck:truck_id(patente)")
        .eq("driver_id", driverId!)
        .order("fecha_desde", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!userId) return <div className="text-center text-muted-foreground">Cargando…</div>;

  if (!perfil || perfil.estado_validacion !== "aprobado") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-amber-900">
        <div className="flex items-center gap-3">
          <Lock className="h-6 w-6" />
          <h1 className="text-xl font-bold">Aún no puedes cargar disponibilidad</h1>
        </div>
        <p className="mt-2 text-sm">Tu inscripción debe estar aprobada por un administrador.</p>
        <Link to="/chofer" className="mt-4 inline-block text-sm text-primary hover:underline">← Volver a mi portal</Link>
      </div>
    );
  }

  if (!driverId) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border p-6">
        <h1 className="text-xl font-bold">Mi disponibilidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu proveedor todavía no te ha registrado en su listado de choferes. Pídele que
          te agregue con el mismo RUT que registraste ({perfil.rut}) para poder cargar
          tu disponibilidad aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Mi disponibilidad</h1>
          <p className="text-sm text-muted-foreground">
            Indica cuándo estás disponible, dónde estás y hacia dónde te mueves.
          </p>
        </div>
        {!showForm && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-dark">
            <Plus className="h-4 w-4" /> Agregar
          </button>
        )}
      </div>

      {showForm && (
        <DisponibilidadChoferForm
          driverId={driverId}
          proveedorUserId={perfil.proveedor_id}
          initial={editing ?? undefined}
          onSaved={() => { setShowForm(false); setEditing(null); dispQuery.refetch(); }}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      <DispList
        rows={dispQuery.data ?? []}
        onEdit={(r) => { setEditing(r); setShowForm(true); }}
        onDeleted={() => dispQuery.refetch()}
      />
    </div>
  );
}

function DispList({ rows, onEdit, onDeleted }: { rows: any[]; onEdit: (r: any) => void; onDeleted: () => void }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Aún no has cargado disponibilidad.
      </div>
    );
  }
  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta disponibilidad?")) return;
    const { error } = await supabase.from("disponibilidad_chofer").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminada");
    onDeleted();
  };
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <article key={r.id} className={`rounded-lg border-l-4 bg-card p-4 shadow-sm ${
          r.estado === "disponible" ? "border-l-emerald-500" : "border-l-red-500"
        }`}>
          <header className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              {r.fecha_desde} → {r.fecha_hasta}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              r.estado === "disponible" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
            }`}>
              {r.estado === "disponible" ? "Disponible" : "No disponible"}
            </span>
          </header>
          <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Lugar:</span>&nbsp;
              {r.lugar?.nombre ?? r.lugar_texto ?? "—"}
            </p>
            <p className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">Destino:</span>&nbsp;
              {r.destino?.nombre ?? r.destino_texto ?? "—"}
            </p>
            {r.modalidad && (
              <p><span className="text-muted-foreground">Tipo:</span>&nbsp;
                {r.modalidad === "consolidado" ? "Consolidado" : "Rampla completa"}
              </p>
            )}
            {r.truck?.patente && (
              <p><span className="text-muted-foreground">Camión:</span>&nbsp;{r.truck.patente}</p>
            )}
          </div>
          {r.notas && <p className="mt-2 text-xs text-muted-foreground">{r.notas}</p>}
          <div className="mt-3 flex gap-2">
            <button onClick={() => onEdit(r)}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
            <button onClick={() => remove(r.id)}
              className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
