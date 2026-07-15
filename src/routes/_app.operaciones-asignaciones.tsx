import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Truck, User, MapPin, Calendar, Package, Loader2, X, RefreshCw, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_app/operaciones-asignaciones")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AsignacionesPage,
});

type Cotizacion = {
  id: string; origen: string; destinos: any; tipo_camion: string | null; modalidad: string | null;
  peso_kg: number | null; fecha_despacho: string | null; estado: string; contacto_nombre: string | null;
};
type Driver = { id: string; nombre_completo: string; rut: string | null; user_id: string; clase_licencia: string | null };
type Truck = { id: string; patente: string; tipo: string | null; user_id: string; marca: string | null; modelo: string | null };
type Disp = { driver_id: string; estado: string; fecha_desde: string; fecha_hasta: string | null; truck_id: string | null; lugar_texto: string | null; destino_texto: string | null };
type Perfil = { user_id: string; proveedor_id: string; rut: string; estado_validacion: string };
type Asignacion = {
  id: string; cotizacion_id: string | null; chofer_id: string; camion_id: string; proveedor_id: string;
  estado_viaje: string; fecha_desde: string; activa: boolean; created_at: string;
  cotizaciones?: Cotizacion | null; drivers?: { nombre_completo: string } | null; trucks?: { patente: string } | null;
};

const ESTADOS_VIAJE = ["por_iniciar", "cargando", "en_ruta", "descargando", "entregado"];

function normRut(v: string | null | undefined) {
  return (v ?? "").replace(/[^0-9kK]/g, "").toLowerCase();
}
function overlaps(dispDesde: string, dispHasta: string | null, fecha: string) {
  const d = new Date(fecha).getTime();
  const from = new Date(dispDesde).getTime();
  const to = new Date(dispHasta ?? dispDesde).getTime();
  return d >= from && d <= to;
}
function tipoMatches(cotTipo: string | null, truckTipo: string | null) {
  if (!cotTipo || !truckTipo) return true;
  const a = cotTipo.toLowerCase().trim();
  const b = truckTipo.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

function AsignacionesPage() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [selected, setSelected] = useState<Cotizacion | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string>("all");

  async function loadAll() {
    setLoading(true);
    const [cotRes, asigRes, drvRes, perfRes, trkRes] = await Promise.all([
      supabase.from("cotizaciones").select("id,origen,destinos,tipo_camion,modalidad,peso_kg,fecha_despacho,estado,contacto_nombre").in("estado", ["pendiente", "cotizada"]).order("fecha_despacho", { ascending: true, nullsFirst: false }),
      supabase.from("asignaciones").select("id,cotizacion_id,chofer_id,camion_id,proveedor_id,estado_viaje,fecha_desde,activa,created_at,cotizaciones(id,origen,destinos,tipo_camion,modalidad,peso_kg,fecha_despacho,estado,contacto_nombre),drivers(nombre_completo),trucks(patente)").order("created_at", { ascending: false }),
      supabase.from("drivers").select("id,nombre_completo,rut,user_id,clase_licencia").is("deleted_at", null),
      supabase.from("chofer_perfiles").select("user_id,proveedor_id,rut,estado_validacion").eq("estado_validacion", "aprobado"),
      supabase.from("trucks").select("id,patente,tipo,user_id,marca,modelo").is("deleted_at", null),
    ]);
    setCotizaciones((cotRes.data ?? []) as any);
    setAsignaciones((asigRes.data ?? []) as any);
    setDrivers((drvRes.data ?? []) as any);
    setPerfiles((perfRes.data ?? []) as any);
    setTrucks((trkRes.data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function loadDispFor(fecha: string) {
    const { data } = await supabase.from("disponibilidad_chofer").select("driver_id,estado,fecha_desde,fecha_hasta,truck_id,lugar_texto,destino_texto").eq("estado", "disponible");
    setDisp((data ?? []).filter((d: any) => overlaps(d.fecha_desde, d.fecha_hasta, fecha)) as any);
  }

  function openCotizacion(c: Cotizacion) {
    setSelected(c);
    setMsg(null);
    if (c.fecha_despacho) loadDispFor(c.fecha_despacho); else setDisp([]);
  }

  // Compute suggested drivers for selected cotización
  const sugeridos = useMemo(() => {
    if (!selected) return [] as Array<{ driver: Driver; perfil: Perfil; disp: Disp | null; trucks: Truck[] }>;
    const aprobadosRuts = new Set<string>(perfiles.map((p) => `${p.proveedor_id}|${normRut(p.rut)}`));
    const proveedorByKey = new Map<string, Perfil>(perfiles.map((p) => [`${p.proveedor_id}|${normRut(p.rut)}`, p]));
    return drivers
      .map((d) => {
        const key = `${d.user_id}|${normRut(d.rut)}`;
        if (!aprobadosRuts.has(key)) return null;
        const perfil = proveedorByKey.get(key)!;
        const dispRow = disp.find((x) => x.driver_id === d.id) ?? null;
        const proveedorTrucks = trucks.filter((t) => t.user_id === d.user_id);
        const matchTrucks = proveedorTrucks.filter((t) => tipoMatches(selected.tipo_camion, t.tipo));
        // Must have availability
        if (!dispRow) return null;
        // If disp has truck, prefer that; else any matching truck
        const available = dispRow.truck_id
          ? proveedorTrucks.filter((t) => t.id === dispRow.truck_id && tipoMatches(selected.tipo_camion, t.tipo))
          : matchTrucks;
        if (available.length === 0) return null;
        return { driver: d, perfil, disp: dispRow, trucks: available };
      })
      .filter(Boolean) as any;
  }, [selected, drivers, perfiles, disp, trucks]);

  async function confirmarAsignacion(driver: Driver, perfil: Perfil, camionId: string) {
    if (!selected) return;
    setSaving(true); setMsg(null);
    const { error: e1 } = await supabase.from("asignaciones").insert({
      cotizacion_id: selected.id,
      chofer_id: driver.id,
      camion_id: camionId,
      proveedor_id: perfil.proveedor_id,
      estado_viaje: "por_iniciar",
      fecha_desde: selected.fecha_despacho ?? new Date().toISOString().slice(0, 10),
      activa: true,
    });
    if (e1) { setMsg("Error al crear asignación: " + e1.message); setSaving(false); return; }
    const { error: e2 } = await supabase.from("cotizaciones").update({ estado: "asignada" }).eq("id", selected.id);
    if (e2) { setMsg("Asignación creada pero no se pudo actualizar cotización: " + e2.message); }
    setSaving(false);
    setSelected(null);
    await loadAll();
  }

  async function cancelarAsignacion(a: Asignacion) {
    if (!confirm("¿Cancelar esta asignación? Se marcará como inactiva y la carga volverá a 'pendiente'.")) return;
    await supabase.from("asignaciones").update({ activa: false }).eq("id", a.id);
    if (a.cotizacion_id) await supabase.from("cotizaciones").update({ estado: "pendiente" }).eq("id", a.cotizacion_id);
    await loadAll();
  }

  async function reasignar(a: Asignacion) {
    if (!confirm("Se cancelará esta asignación para permitir reasignar. ¿Continuar?")) return;
    await supabase.from("asignaciones").update({ activa: false }).eq("id", a.id);
    if (a.cotizacion_id) {
      await supabase.from("cotizaciones").update({ estado: "pendiente" }).eq("id", a.cotizacion_id);
      const c = a.cotizaciones;
      if (c) openCotizacion(c);
    }
    await loadAll();
  }

  const filteredAsig = asignaciones.filter((a) => filterEstado === "all" || a.estado_viaje === filterEstado);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-dark">Asignaciones</h1>
          <p className="text-sm text-muted-foreground">Asigna cargas pendientes a choferes disponibles.</p>
        </div>
        <button onClick={loadAll} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refrescar
        </button>
      </header>

      {msg && <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center gap-2"><AlertCircle className="h-4 w-4" />{msg}</div>}

      {/* Cargas pendientes */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-3">Cargas por asignar ({cotizaciones.length})</h2>
        {loading ? <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div> :
          cotizaciones.length === 0 ? <p className="text-sm text-muted-foreground">No hay cargas pendientes ni cotizadas.</p> :
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {cotizaciones.map((c) => (
              <button key={c.id} onClick={() => openCotizacion(c)} className="text-left rounded-lg border p-3 hover:border-primary hover:bg-primary-soft/30 transition">
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.estado === "pendiente" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{c.estado}</span>
                  <span className="text-xs text-muted-foreground">{c.fecha_despacho ?? "s/f"}</span>
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 mt-0.5 text-primary" /><span className="line-clamp-2">{c.origen} → {Array.isArray(c.destinos) ? c.destinos.map((d: any) => typeof d === "string" ? d : d?.direccion ?? "").join(", ") : ""}</span></div>
                <div className="mt-1 text-xs text-muted-foreground flex gap-3 flex-wrap">
                  {c.tipo_camion && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{c.tipo_camion}</span>}
                  {c.modalidad && <span>{c.modalidad}</span>}
                  {c.peso_kg && <span>{c.peso_kg} kg</span>}
                </div>
              </button>
            ))}
          </div>
        }
      </section>

      {/* Asignación panel */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto p-4">
          <div className="bg-background rounded-xl border shadow-lg w-full max-w-3xl mt-8">
            <div className="flex items-center justify-between border-b p-4">
              <h3 className="font-semibold">Asignar carga</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /><b>{selected.origen}</b> → {Array.isArray(selected.destinos) ? selected.destinos.map((d: any) => typeof d === "string" ? d : d?.direccion ?? "").join(", ") : ""}</div>
                <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{selected.fecha_despacho ?? "sin fecha"}</span>
                  {selected.tipo_camion && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" />{selected.tipo_camion}</span>}
                  {selected.modalidad && <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" />{selected.modalidad}</span>}
                  {selected.peso_kg && <span>{selected.peso_kg} kg</span>}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Choferes sugeridos ({sugeridos.length})</h4>
                {!selected.fecha_despacho && <p className="text-xs text-amber-700 mb-2">Esta carga no tiene fecha de despacho; no se puede filtrar por disponibilidad.</p>}
                {sugeridos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay choferes aprobados disponibles con camión que calce para esa fecha.</p>
                ) : (
                  <div className="space-y-2">
                    {sugeridos.map(({ driver, perfil, disp: d, trucks: ts }: any) => (
                      <ChoferRow key={driver.id} driver={driver} perfil={perfil} disp={d} trucks={ts} disabled={saving} onConfirm={(camionId) => confirmarAsignacion(driver, perfil, camionId)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Existing asignaciones */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Asignaciones existentes ({filteredAsig.length})</h2>
          <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} className="text-sm border rounded-md px-2 py-1">
            <option value="all">Todos los estados</option>
            {ESTADOS_VIAJE.map((e) => <option key={e} value={e}>{e.replace("_", " ")}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3">Carga</th>
                <th className="py-2 pr-3">Chofer</th>
                <th className="py-2 pr-3">Camión</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Estado viaje</th>
                <th className="py-2 pr-3">Activa</th>
                <th className="py-2 pr-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAsig.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Sin asignaciones.</td></tr>
              ) : filteredAsig.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{a.cotizaciones ? `${a.cotizaciones.origen} → …` : <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 pr-3">{a.drivers?.nombre_completo ?? "—"}</td>
                  <td className="py-2 pr-3">{a.trucks?.patente ?? "—"}</td>
                  <td className="py-2 pr-3">{a.fecha_desde}</td>
                  <td className="py-2 pr-3"><span className="text-xs rounded-full bg-muted px-2 py-0.5">{a.estado_viaje.replace("_", " ")}</span></td>
                  <td className="py-2 pr-3">{a.activa ? <span className="text-emerald-700">Sí</span> : <span className="text-muted-foreground">No</span>}</td>
                  <td className="py-2 pr-3 text-right space-x-2">
                    {a.activa && a.estado_viaje === "por_iniciar" && (
                      <button onClick={() => reasignar(a)} className="text-xs rounded-md border px-2 py-1 hover:bg-muted">Reasignar</button>
                    )}
                    {a.activa && (
                      <button onClick={() => cancelarAsignacion(a)} className="text-xs rounded-md border border-red-300 text-red-700 px-2 py-1 hover:bg-red-50">Cancelar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ChoferRow({ driver, perfil, disp, trucks, disabled, onConfirm }: { driver: Driver; perfil: Perfil; disp: Disp | null; trucks: Truck[]; disabled: boolean; onConfirm: (camionId: string) => void }) {
  const [camionId, setCamionId] = useState(trucks[0]?.id ?? "");
  return (
    <div className="rounded-md border p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="text-sm">
        <div className="font-medium flex items-center gap-2"><User className="h-4 w-4 text-primary" />{driver.nombre_completo}</div>
        <div className="text-xs text-muted-foreground">
          Licencia {driver.clase_licencia ?? "—"} · RUT {driver.rut ?? "—"}
          {disp && <> · Disp. {disp.fecha_desde}{disp.fecha_hasta ? ` → ${disp.fecha_hasta}` : ""}{disp.lugar_texto ? ` desde ${disp.lugar_texto}` : ""}</>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select value={camionId} onChange={(e) => setCamionId(e.target.value)} className="text-sm border rounded-md px-2 py-1">
          {trucks.map((t) => <option key={t.id} value={t.id}>{t.patente} · {t.tipo ?? "sin tipo"}</option>)}
        </select>
        <button disabled={disabled || !camionId} onClick={() => onConfirm(camionId)} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary-dark disabled:opacity-50">
          Asignar
        </button>
      </div>
    </div>
  );
}
