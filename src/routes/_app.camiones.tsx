import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X, UserPlus, AlertTriangle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TIPOS_CAMION } from "@/lib/regions";
import { StatusBadge } from "@/components/StatusBadge";
import { ESTADOS_OPERATIVOS, estadoMeta, licenseCovers, type EstadoOperativo } from "@/lib/fleet";

export const Route = createFileRoute("/_app/camiones")({
  head: () => pageHead("/camiones", "Mis camiones · Portal Proveedores TN Chile", "Administra tu flota de camiones en TN Chile: patente, tipo, capacidad, documentos vigentes y estado operativo de cada vehículo."),
  component: CamionesPage,
});

const EMPTY = {
  patente: "", marca: "", modelo: "", anio: "", tipo: "Tracto",
  capacidad_toneladas: "", numero_ejes: "",
  soap_vencimiento: "", permiso_circulacion_vencimiento: "", revision_tecnica_vencimiento: "",
};

type Driver = { id: string; nombre_completo: string; clase_licencia: string | null };
type Asign = { id: string; camion_id: string; chofer_id: string; activa: boolean };

function CamionesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [asigns, setAsigns] = useState<Asign[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const [{ data: ts }, { data: ds }, { data: as }] = await Promise.all([
      supabase.from("trucks").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("drivers").select("id,nombre_completo,clase_licencia").is("deleted_at", null).order("nombre_completo"),
      (supabase as any).from("asignaciones").select("*").eq("activa", true),
    ]);
    setItems(ts ?? []);
    setDrivers(ds ?? []);
    setAsigns(as ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing(null); setOpen(true); };
  const openEdit = (t: any) => { setForm({ ...t }); setEditing(t.id); setOpen(true); };

  const save = async () => {
    if (!userId) return;
    const payload: any = { ...form, user_id: userId };
    ["anio", "capacidad_toneladas", "numero_ejes"].forEach((k) => {
      payload[k] = payload[k] === "" ? null : Number(payload[k]);
    });
    ["soap_vencimiento", "permiso_circulacion_vencimiento", "revision_tecnica_vencimiento"].forEach((k) => {
      if (!payload[k]) payload[k] = null;
    });
    const res = editing
      ? await supabase.from("trucks").update(payload).eq("id", editing)
      : await supabase.from("trucks").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success(editing ? "Camión actualizado" : "Camión agregado"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este camión?")) return;
    const { error } = await supabase.from("trucks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Eliminado"); load(); }
  };

  const setEstado = async (truck: any, estado: EstadoOperativo) => {
    setItems((prev) => prev.map((t) => (t.id === truck.id ? { ...t, estado_operativo: estado } : t)));
    const { error } = await supabase.from("trucks").update({ estado_operativo: estado } as any).eq("id", truck.id);
    if (error) { toast.error(error.message); load(); }
  };

  const assignDriver = async (truck: any, chofer_id: string | null) => {
    if (!userId) return;
    // Deactivate any current assignment for this truck
    await (supabase as any).from("asignaciones").update({ activa: false, fecha_hasta: new Date().toISOString().slice(0,10) }).eq("camion_id", truck.id).eq("activa", true);
    if (chofer_id) {
      const { error } = await (supabase as any).from("asignaciones").insert({
        proveedor_id: userId, camion_id: truck.id, chofer_id, activa: true,
      });
      if (error) { toast.error(error.message); return; }
      toast.success("Chofer asignado");
    } else {
      toast.success("Asignación removida");
    }
    setAssignFor(null);
    load();
  };

  const assignedDriverFor = (truckId: string) => {
    const a = asigns.find((x) => x.camion_id === truckId && x.activa);
    if (!a) return null;
    return drivers.find((d) => d.id === a.chofer_id) ?? null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Camiones</h1>
          <p className="text-muted-foreground">Tu flota registrada.</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
          <Plus className="h-4 w-4" /> Nuevo camión
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft text-left">
              <tr>
                {["Patente", "Marca/Modelo", "Tipo", "Estado", "Chofer asignado", "SOAP", "Permiso", "Rev. Téc.", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
                : items.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Aún no hay camiones</td></tr>
                : items.map((t) => {
                  const drv = assignedDriverFor(t.id);
                  const meta = estadoMeta(t.estado_operativo);
                  const warn = drv && !licenseCovers(drv.clase_licencia, t.tipo);
                  return (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{t.patente}</td>
                    <td className="px-4 py-3">{t.marca} {t.modelo} {t.anio && `(${t.anio})`}</td>
                    <td className="px-4 py-3">{t.tipo}</td>
                    <td className="px-4 py-3">
                      <select
                        value={t.estado_operativo ?? "disponible"}
                        onChange={(e) => setEstado(t, e.target.value as EstadoOperativo)}
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border-0 ${meta.bg} ${meta.text}`}
                      >
                        {ESTADOS_OPERATIVOS.map((s) => (
                          <option key={s.value} value={s.value}>● {s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {drv ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium">
                            <UserCheck className="h-3 w-3" /> {drv.nombre_completo}
                            {drv.clase_licencia && <span className="text-muted-foreground">· {drv.clase_licencia}</span>}
                          </span>
                          {warn && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700">
                              <AlertTriangle className="h-3 w-3" />
                              La clase de licencia podría no cubrir este tipo de vehículo.
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatusBadge fecha={t.soap_vencimiento} /></td>
                    <td className="px-4 py-3"><StatusBadge fecha={t.permiso_circulacion_vencimiento} /></td>
                    <td className="px-4 py-3"><StatusBadge fecha={t.revision_tecnica_vencimiento} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setAssignFor(t)} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                        <UserPlus className="h-3 w-3" /> Asignar chofer
                      </button>
                      <button onClick={() => openEdit(t)} className="ml-3 text-sm text-primary hover:underline">Editar</button>
                      <button onClick={() => remove(t.id)} aria-label="Eliminar camión" className="ml-3 text-destructive hover:opacity-80"><Trash2 className="inline h-4 w-4" /></button>
                    </td>
                  </tr>
                )})}
            </tbody>
          </table>
        </div>
      </div>

      {assignFor && (
        <AssignModal
          truck={assignFor}
          drivers={drivers}
          current={assignedDriverFor(assignFor.id)?.id ?? null}
          onClose={() => setAssignFor(null)}
          onAssign={(id) => assignDriver(assignFor, id)}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? "Editar camión" : "Nuevo camión"}</h2>
              <button onClick={() => setOpen(false)} aria-label="Cerrar"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Patente" value={form.patente} onChange={(v) => setForm({ ...form, patente: v })} />
              <Field label="Marca" value={form.marca} onChange={(v) => setForm({ ...form, marca: v })} />
              <Field label="Modelo" value={form.modelo} onChange={(v) => setForm({ ...form, modelo: v })} />
              <Field label="Año" type="number" value={form.anio} onChange={(v) => setForm({ ...form, anio: v })} />
              <div>
                <label className="block text-sm font-medium">Tipo</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {TIPOS_CAMION.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <Field label="Capacidad (ton)" type="number" value={form.capacidad_toneladas} onChange={(v) => setForm({ ...form, capacidad_toneladas: v })} />
              <Field label="N° ejes" type="number" value={form.numero_ejes} onChange={(v) => setForm({ ...form, numero_ejes: v })} />
              <Field label="Vencimiento SOAP" type="date" value={form.soap_vencimiento} onChange={(v) => setForm({ ...form, soap_vencimiento: v })} />
              <Field label="Vencimiento permiso circulación" type="date" value={form.permiso_circulacion_vencimiento} onChange={(v) => setForm({ ...form, permiso_circulacion_vencimiento: v })} />
              <Field label="Vencimiento revisión técnica" type="date" value={form.revision_tecnica_vencimiento} onChange={(v) => setForm({ ...form, revision_tecnica_vencimiento: v })} />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
              <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssignModal({ truck, drivers, current, onClose, onAssign }: {
  truck: any; drivers: Driver[]; current: string | null;
  onClose: () => void; onAssign: (chofer_id: string | null) => void;
}) {
  const [sel, setSel] = useState<string>(current ?? "");
  const previewDrv = useMemo(() => drivers.find((d) => d.id === sel) ?? null, [drivers, sel]);
  const warn = previewDrv && !licenseCovers(previewDrv.clase_licencia, truck.tipo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Asignar chofer</h2>
          <button onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Camión <span className="font-semibold text-foreground">{truck.patente}</span> · Tipo {truck.tipo}
        </p>
        <label className="block text-sm font-medium">Chofer</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">— Sin asignar —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre_completo}{d.clase_licencia ? ` · Clase ${d.clase_licencia}` : ""}
            </option>
          ))}
        </select>
        {warn && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <span>⚠️ La clase de licencia podría no cubrir este tipo de vehículo.</span>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={() => onAssign(sel || null)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
            Guardar asignación
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}
