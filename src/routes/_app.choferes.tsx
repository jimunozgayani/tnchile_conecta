import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CLASES_LICENCIA } from "@/lib/regions";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_app/choferes")({
  component: ChoferesPage,
});

const EMPTY = {
  nombre_completo: "", rut: "", celular: "", clase_licencia: "A1",
  licencia_vencimiento: "", carnet_vencimiento: "", foto_url: "",
};

function ChoferesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [userId, setUserId] = useState("");

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase.from("drivers").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const uploadPhoto = async (file: File) => {
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("driver-photos").upload(path, file);
    if (error) return toast.error(error.message);
    setForm((f: any) => ({ ...f, foto_url: path }));
    toast.success("Foto cargada");
  };

  const save = async () => {
    const payload: any = { ...form, user_id: userId };
    ["licencia_vencimiento", "carnet_vencimiento"].forEach((k) => { if (!payload[k]) payload[k] = null; });
    const res = editing
      ? await supabase.from("drivers").update(payload).eq("id", editing)
      : await supabase.from("drivers").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success(editing ? "Actualizado" : "Agregado"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este chofer?")) return;
    const { error } = await supabase.from("drivers").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Eliminado"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Choferes</h1>
          <p className="text-muted-foreground">Conductores y vencimientos de licencia.</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
          <Plus className="h-4 w-4" /> Nuevo chofer
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? <p className="text-muted-foreground">Cargando...</p>
          : items.length === 0 ? <p className="text-muted-foreground">Aún no hay choferes registrados.</p>
          : items.map((d) => (
            <div key={d.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                {d.foto_url ? (
                  <img src={supabase.storage.from("driver-photos").getPublicUrl(d.foto_url).data.publicUrl}
                    alt="" className="h-14 w-14 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
                    {d.nombre_completo?.[0] ?? "?"}
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold">{d.nombre_completo}</p>
                  <p className="text-xs text-muted-foreground">{d.rut} · Lic. {d.clase_licencia}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-muted-foreground">📱 {d.celular || "—"}</p>
                <div className="flex flex-wrap gap-1.5 pt-2">
                  <StatusBadge fecha={d.licencia_vencimiento} label="Licencia" />
                  <StatusBadge fecha={d.carnet_vencimiento} label="Carnet" />
                </div>
              </div>
              <div className="mt-3 flex justify-end gap-3 border-t pt-3 text-sm">
                <button onClick={() => { setForm(d); setEditing(d.id); setOpen(true); }} className="text-primary hover:underline">Editar</button>
                <button onClick={() => remove(d.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? "Editar chofer" : "Nuevo chofer"}</h2>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Nombre completo" value={form.nombre_completo} onChange={(v) => setForm({ ...form, nombre_completo: v })} />
              <Field label="RUT" value={form.rut} onChange={(v) => setForm({ ...form, rut: v })} />
              <Field label="Celular" value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} />
              <div>
                <label className="block text-sm font-medium">Clase licencia</label>
                <select value={form.clase_licencia} onChange={(e) => setForm({ ...form, clase_licencia: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {CLASES_LICENCIA.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <Field label="Vencimiento licencia" type="date" value={form.licencia_vencimiento} onChange={(v) => setForm({ ...form, licencia_vencimiento: v })} />
              <Field label="Vencimiento carnet identidad" type="date" value={form.carnet_vencimiento} onChange={(v) => setForm({ ...form, carnet_vencimiento: v })} />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Foto (opcional)</label>
                <input type="file" accept="image/*"
                  onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                  className="mt-1 block text-sm" />
                {form.foto_url && <p className="mt-1 text-xs text-success">✓ Foto cargada</p>}
              </div>
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
