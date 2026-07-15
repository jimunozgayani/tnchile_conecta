import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Trash2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/mi-disponibilidad")({
  head: () => pageHead("/mi-disponibilidad", "Disponibilidad de mi flota · Proveedor TN Chile", "Gestiona la disponibilidad diaria de tus camiones por rango de fechas para que operaciones TN Chile pueda asignarlos a nuevas cargas."),
  component: MiDisponibilidadPage,
});

type Estado = "disponible" | "no_disponible" | "sin_confirmar";
type TipoCarga = "consolidando" | "rampla_completa";

type TruckRow = { id: string; patente: string; marca: string | null; modelo: string | null; tipo: string | null };
type Disp = {
  id: string;
  camion_id: string;
  fecha: string;
  estado: Estado;
  lugar: string | null;
  destino: string | null;
  tipo_carga: string | null;
};

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const estadoBadge: Record<Estado, string> = {
  disponible: "bg-emerald-100 text-emerald-800 border-emerald-300",
  no_disponible: "bg-red-100 text-red-800 border-red-300",
  sin_confirmar: "bg-zinc-100 text-zinc-700 border-zinc-300",
};

function MiDisponibilidadPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [disps, setDisps] = useState<Disp[]>([]);
  const [loading, setLoading] = useState(true);

  const [dlgOpen, setDlgOpen] = useState(false);
  const [form, setForm] = useState({
    camion_id: "",
    fecha_inicio: isoDate(new Date()),
    fecha_fin: isoDate(new Date()),
    estado: "disponible" as Estado,
    lugar: "",
    destino: "",
    tipo_carga: "" as TipoCarga | "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
      if (isAdmin) { navigate({ to: "/operaciones-disponibilidad-mapa" }); return; }
      setReady(true);
    })();
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    const { data: t } = await supabase
      .from("trucks")
      .select("id, patente, marca, modelo, tipo")
      .is("deleted_at", null)
      .order("patente");
    const rows = (t ?? []) as TruckRow[];
    setTrucks(rows);
    if (rows.length === 0) { setDisps([]); setLoading(false); return; }
    const today = isoDate(new Date());
    const { data: d } = await (supabase as any)
      .from("disponibilidad_camion")
      .select("id, camion_id, fecha, estado, lugar, destino, tipo_carga")
      .in("camion_id", rows.map((r) => r.id))
      .gte("fecha", today)
      .order("fecha");
    setDisps((d ?? []) as Disp[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!ready) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (trucks.length && !form.camion_id) setForm((f) => ({ ...f, camion_id: trucks[0].id }));
  }, [trucks, form.camion_id]);

  const dispsByTruck = useMemo(() => {
    const m = new Map<string, Disp[]>();
    disps.forEach((d) => { const a = m.get(d.camion_id) ?? []; a.push(d); m.set(d.camion_id, a); });
    return m;
  }, [disps]);

  const submit = async () => {
    if (!form.camion_id) { toast.error("Selecciona un camión."); return; }
    if (form.fecha_fin < form.fecha_inicio) { toast.error("La fecha fin debe ser posterior o igual a la inicio."); return; }
    setSaving(true);
    const dates: string[] = [];
    let cur = new Date(form.fecha_inicio + "T00:00:00");
    const end = new Date(form.fecha_fin + "T00:00:00");
    while (cur <= end) { dates.push(isoDate(cur)); cur = addDays(cur, 1); }
    if (dates.length > 120) {
      setSaving(false);
      toast.error("El rango es demasiado amplio (máx. 120 días).");
      return;
    }
    const rows = dates.map((f) => ({
      camion_id: form.camion_id,
      fecha: f,
      estado: form.estado,
      lugar: form.lugar.trim() || null,
      destino: form.destino.trim() || null,
      tipo_carga: form.tipo_carga || null,
    }));
    const { error } = await (supabase as any)
      .from("disponibilidad_camion")
      .upsert(rows, { onConflict: "camion_id,fecha" });
    setSaving(false);
    if (error) { toast.error("No se pudo guardar: " + error.message); return; }
    toast.success(`Guardado (${rows.length} día${rows.length > 1 ? "s" : ""}).`);
    setDlgOpen(false);
    setForm((f) => ({ ...f, lugar: "", destino: "", tipo_carga: "" }));
    load();
  };

  const removeEntry = async (id: string) => {
    const { error } = await (supabase as any).from("disponibilidad_camion").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar: " + error.message); return; }
    toast.success("Entrada eliminada.");
    load();
  };

  if (!ready) return <div className="text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Mi disponibilidad</h1>
          <p className="text-sm text-muted-foreground">
            Marca disponibilidad de tus camiones por rango de fechas. El equipo TN Chile lo verá en tiempo real.
          </p>
        </div>
        <Button onClick={() => setDlgOpen(true)} disabled={trucks.length === 0}>
          <CalendarRange className="h-4 w-4" /> Marcar disponibilidad
        </Button>
      </div>

      {trucks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No tienes camiones registrados. Agrega uno desde <span className="font-semibold">Camiones</span> para poder marcar disponibilidad.
        </div>
      ) : (
        <div className="space-y-4">
          {trucks.map((t) => {
            const rows = dispsByTruck.get(t.id) ?? [];
            return (
              <div key={t.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-semibold">{t.patente}</div>
                      <div className="text-xs text-muted-foreground">
                        {[t.marca, t.modelo].filter(Boolean).join(" ") || t.tipo || "—"}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setForm((f) => ({ ...f, camion_id: t.id })); setDlgOpen(true); }}>
                    Marcar rango
                  </Button>
                </div>
                {loading ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">Cargando…</div>
                ) : rows.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">Sin entradas futuras para este camión.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Estado</th>
                          <th className="px-3 py-2 text-left">Lugar</th>
                          <th className="px-3 py-2 text-left">Destino</th>
                          <th className="px-3 py-2 text-left">Carga</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className="border-t border-border">
                            <td className="px-3 py-2">{r.fecha}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${estadoBadge[r.estado]}`}>
                                {r.estado.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-3 py-2">{r.lugar || "—"}</td>
                            <td className="px-3 py-2">{r.destino || "—"}</td>
                            <td className="px-3 py-2">{r.tipo_carga ? r.tipo_carga.replace("_", " ") : "—"}</td>
                            <td className="px-3 py-2 text-right">
                              <Button variant="ghost" size="sm" onClick={() => removeEntry(r.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Marcar disponibilidad por rango</DialogTitle>
            <DialogDescription>
              Aplica un estado a un rango de fechas. Si ya existía una entrada para esa fecha se sobrescribe.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Camión</Label>
              <Select value={form.camion_id} onValueChange={(v) => setForm({ ...form, camion_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un camión" /></SelectTrigger>
                <SelectContent>
                  {trucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.patente}{t.tipo ? ` · ${t.tipo}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v as Estado })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="no_disponible">No disponible</SelectItem>
                  <SelectItem value="sin_confirmar">Sin confirmar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Lugar (opcional)</Label>
                <Input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })} placeholder="Origen" />
              </div>
              <div className="space-y-1.5">
                <Label>Destino (opcional)</Label>
                <Input value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} placeholder="Destino" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de carga (opcional)</Label>
              <Select value={form.tipo_carga || "__none__"} onValueChange={(v) => setForm({ ...form, tipo_carga: v === "__none__" ? "" : (v as TipoCarga) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin especificar</SelectItem>
                  <SelectItem value="consolidando">Consolidando</SelectItem>
                  <SelectItem value="rampla_completa">Rampla completa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
