import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TIPOS_CAMION } from "@/lib/regions";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_app/camiones")({
  component: CamionesPage,
});

const EMPTY = {
  patente: "", marca: "", modelo: "", anio: "", tipo: "Tracto",
  capacidad_toneladas: "", numero_ejes: "",
  soap_vencimiento: "", permiso_circulacion_vencimiento: "", revision_tecnica_vencimiento: "",
};

function CamionesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("trucks").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing(null); setOpen(true); };
  const openEdit = (t: any) => { setForm({ ...t }); setEditing(t.id); setOpen(true); };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = { ...form, user_id: user.id };
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
    const { error } = await supabase.from("trucks").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
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
                {["Patente", "Marca/Modelo", "Tipo", "Capacidad", "SOAP", "Permiso", "Rev. Técnica", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
                : items.length === 0 ? <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Aún no hay camiones</td></tr>
                : items.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold">{t.patente}</td>
                    <td className="px-4 py-3">{t.marca} {t.modelo} {t.anio && `(${t.anio})`}</td>
                    <td className="px-4 py-3">{t.tipo}</td>
                    <td className="px-4 py-3">{t.capacidad_toneladas ? `${t.capacidad_toneladas} t` : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge fecha={t.soap_vencimiento} /></td>
                    <td className="px-4 py-3"><StatusBadge fecha={t.permiso_circulacion_vencimiento} /></td>
                    <td className="px-4 py-3"><StatusBadge fecha={t.revision_tecnica_vencimiento} /></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(t)} className="text-sm text-primary hover:underline">Editar</button>
                      <button onClick={() => remove(t.id)} className="ml-3 text-destructive hover:opacity-80"><Trash2 className="inline h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? "Editar camión" : "Nuevo camión"}</h2>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
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

function Field({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}
