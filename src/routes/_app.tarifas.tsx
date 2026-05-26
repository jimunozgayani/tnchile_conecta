import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { REGIONES_CHILE, TIPOS_CAMION } from "@/lib/regions";

export const Route = createFileRoute("/_app/tarifas")({
  component: TarifasPage,
});

const EMPTY = { origen: "Santiago", destino: "Valparaíso", tipo_camion: "Tracto", precio_base_clp: "", precio_km_adicional: "" };

const ORIGENES = ["Santiago", ...REGIONES_CHILE];

function TarifasPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("rates").select("*").order("origen").order("destino");
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload: any = {
      ...form,
      user_id: user.id,
      precio_base_clp: form.precio_base_clp === "" ? null : Number(form.precio_base_clp),
      precio_km_adicional: form.precio_km_adicional === "" ? null : Number(form.precio_km_adicional),
    };
    const res = editing
      ? await supabase.from("rates").update(payload).eq("id", editing)
      : await supabase.from("rates").insert(payload);
    if (res.error) toast.error(res.error.message);
    else { toast.success(editing ? "Tarifa actualizada" : "Tarifa creada"); setOpen(false); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar tarifa?")) return;
    const { error } = await supabase.from("rates").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Eliminada"); load(); }
  };

  const fmt = (n: number) => n ? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n) : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tarifas</h1>
          <p className="text-muted-foreground">Precios por ruta entre capitales regionales.</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setEditing(null); setOpen(true); }}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-dark">
          <Plus className="h-4 w-4" /> Nueva tarifa
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary-soft text-left">
              <tr>
                {["Origen", "Destino", "Tipo camión", "Precio base", "Precio/km adicional", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
                : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Aún no hay tarifas</td></tr>
                : items.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">{r.origen}</td>
                    <td className="px-4 py-3">→ {r.destino}</td>
                    <td className="px-4 py-3">{r.tipo_camion}</td>
                    <td className="px-4 py-3 font-mono">{fmt(r.precio_base_clp)}</td>
                    <td className="px-4 py-3 font-mono">{fmt(r.precio_km_adicional)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setForm(r); setEditing(r.id); setOpen(true); }} className="text-primary hover:underline">Editar</button>
                      <button onClick={() => remove(r.id)} className="ml-3 text-destructive"><Trash2 className="inline h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? "Editar tarifa" : "Nueva tarifa"}</h2>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Origen</label>
                <select value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {ORIGENES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Destino</label>
                <select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {REGIONES_CHILE.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Tipo camión</label>
                <select value={form.tipo_camion} onChange={(e) => setForm({ ...form, tipo_camion: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {TIPOS_CAMION.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Precio base (CLP)</label>
                <input type="number" value={form.precio_base_clp} onChange={(e) => setForm({ ...form, precio_base_clp: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Precio por km adicional (CLP)</label>
                <input type="number" value={form.precio_km_adicional} onChange={(e) => setForm({ ...form, precio_km_adicional: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
