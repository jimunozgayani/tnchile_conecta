import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, MapPin, Plus, Trash2, Truck, UserCog } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/operaciones-disponibilidad-mapa")({
  head: () => pageHead("/operaciones-disponibilidad-mapa", "Disponibilidad de camiones · Operaciones TN Chile", "Calendario semanal y mapa de disponibilidad de camiones para planificar asignaciones de carga en TN Chile."),
  component: DisponibilidadOperacionesPage,
});

type Estado = "disponible" | "no_disponible" | "sin_confirmar";
type TipoCarga = "consolidando" | "rampla_completa";

type TruckRow = {
  id: string;
  patente: string;
  marca: string | null;
  modelo: string | null;
  tipo: string | null;
  user_id: string | null;
  proveedor_secundario_nombre: string | null;
};

type Disp = {
  id?: string;
  camion_id: string;
  fecha: string;
  estado: Estado;
  lugar: string | null;
  destino: string | null;
  tipo_carga: string | null;
};

type Ciudad = { id: string; nombre: string; region: string | null; lat: number; lng: number };
type ProfileMap = Record<string, string>;

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtShort = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

const estadoBg: Record<Estado, string> = {
  disponible: "bg-emerald-600 text-white hover:bg-emerald-500 ring-1 ring-inset ring-emerald-400/40",
  no_disponible: "bg-red-600 text-white hover:bg-red-500 ring-1 ring-inset ring-red-400/40",
  sin_confirmar: "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700 ring-1 ring-inset ring-zinc-600/60",
};

const PIN_COLORS: Record<Estado, string> = {
  disponible: "#059669",
  no_disponible: "#dc2626",
  sin_confirmar: "#71717a",
};

function pinIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:28px;height:36px;">
      <div style="position:absolute;inset:0;background:${color};clip-path:path('M14 0C6.3 0 0 6.3 0 14c0 10 14 22 14 22s14-12 14-22C28 6.3 21.7 0 14 0z');box-shadow:0 2px 4px rgba(0,0,0,.3);"></div>
      <div style="position:absolute;top:7px;left:9px;width:10px;height:10px;background:white;border-radius:50%;"></div>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  });
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function matchCiudad(texto: string | null | undefined, ciudades: Ciudad[]): Ciudad | null {
  if (!texto) return null;
  const n = normalize(texto);
  if (!n) return null;
  let best: Ciudad | null = null;
  for (const c of ciudades) {
    const cn = normalize(c.nombre);
    if (n === cn) return c;
    if (!best && (n.includes(cn) || cn.includes(n))) best = c;
  }
  return best;
}

function MapAutoFit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 7); return; }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

function DisponibilidadOperacionesPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [disps, setDisps] = useState<Disp[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterTipo, setFilterTipo] = useState<string>("__all__");
  const [filterProveedor, setFilterProveedor] = useState<string>("__all__");
  const [mapDay, setMapDay] = useState<string>(() => isoDate(new Date()));

  const [editOpen, setEditOpen] = useState(false);
  const [editState, setEditState] = useState<{
    truck: TruckRow;
    fecha_inicio: string;
    fecha_fin: string;
    estado: Estado;
    lugar: string;
    destino: string;
    tipo_carga: TipoCarga | "";
    existingId?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addState, setAddState] = useState({ nombre: "", tipo: "", patente: "" });
  const [addSaving, setAddSaving] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const todayIso = useMemo(() => isoDate(new Date()), []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate({ to: "/login" }); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const admin = (data ?? []).some((r: any) => r.role === "admin");
      setIsAdmin(admin);
      if (!admin) navigate({ to: "/dashboard" });
    })();
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("ciudades_chile").select("id,nombre,region,lat,lng");
      setCiudades((data ?? []) as any);
    })();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data: t } = await supabase
      .from("trucks")
      .select("id, patente, marca, modelo, tipo, user_id, proveedor_secundario_nombre")
      .is("deleted_at", null)
      .order("patente");
    const tr = (t ?? []) as TruckRow[];
    setTrucks(tr);

    const userIds = Array.from(new Set(tr.map((x) => x.user_id).filter(Boolean))) as string[];
    if (userIds.length) {
      const { data: p } = await supabase.from("profiles").select("id, razon_social, nombre_contacto").in("id", userIds);
      const map: ProfileMap = {};
      (p ?? []).forEach((x: any) => { map[x.id] = x.razon_social || x.nombre_contacto || "Proveedor"; });
      setProfiles(map);
    } else setProfiles({});

    const from = isoDate(days[0]);
    const to = isoDate(days[6]);
    const { data: d } = await (supabase as any)
      .from("disponibilidad_camion")
      .select("id, camion_id, fecha, estado, lugar, destino, tipo_carga")
      .gte("fecha", from)
      .lte("fecha", to);
    setDisps((d ?? []) as Disp[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, weekStart]);

  // keep mapDay inside the visible week
  useEffect(() => {
    const from = isoDate(days[0]);
    const to = isoDate(days[6]);
    if (mapDay < from || mapDay > to) setMapDay(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const proveedorNombre = (t: TruckRow) =>
    t.user_id ? (profiles[t.user_id] ?? "Proveedor") : (t.proveedor_secundario_nombre || "Proveedor secundario");

  const tiposDisponibles = useMemo(
    () => Array.from(new Set(trucks.map((t) => t.tipo).filter(Boolean))) as string[],
    [trucks],
  );
  const proveedoresDisponibles = useMemo(() => {
    const s = new Set<string>();
    trucks.forEach((t) => s.add(proveedorNombre(t)));
    return Array.from(s).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trucks, profiles]);

  const trucksFiltered = useMemo(
    () => trucks.filter((t) =>
      (filterTipo === "__all__" || t.tipo === filterTipo) &&
      (filterProveedor === "__all__" || proveedorNombre(t) === filterProveedor)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trucks, filterTipo, filterProveedor, profiles],
  );

  const dispMap = useMemo(() => {
    const m = new Map<string, Disp>();
    for (const d of disps) m.set(`${d.camion_id}|${d.fecha}`, d);
    return m;
  }, [disps]);

  const truckMap = useMemo(() => new Map(trucks.map((t) => [t.id, t])), [trucks]);

  // Build map pins for selected mapDay from disponibilidad_camion (matched to ciudades_chile by name)
  const pinData = useMemo(() => {
    const filteredIds = new Set(trucksFiltered.map((t) => t.id));
    const rows = disps.filter((d) => d.fecha === mapDay && filteredIds.has(d.camion_id));
    const withLoc: Array<{ disp: Disp; truck: TruckRow; origen: Ciudad; destino: Ciudad | null }> = [];
    const withoutLoc: Array<{ disp: Disp; truck: TruckRow }> = [];
    for (const d of rows) {
      const t = truckMap.get(d.camion_id);
      if (!t) continue;
      const origen = matchCiudad(d.lugar, ciudades);
      if (origen) {
        withLoc.push({ disp: d, truck: t, origen, destino: matchCiudad(d.destino, ciudades) });
      } else {
        withoutLoc.push({ disp: d, truck: t });
      }
    }
    return { withLoc, withoutLoc };
  }, [disps, mapDay, trucksFiltered, truckMap, ciudades]);

  const points: [number, number][] = pinData.withLoc.map((r) => [Number(r.origen.lat), Number(r.origen.lng)]);

  const openEdit = (truck: TruckRow, iso: string) => {
    const entry = dispMap.get(`${truck.id}|${iso}`);
    setEditState({
      truck,
      fecha_inicio: iso,
      fecha_fin: iso,
      estado: entry?.estado ?? "sin_confirmar",
      lugar: entry?.lugar ?? "",
      destino: entry?.destino ?? "",
      tipo_carga: (entry?.tipo_carga as TipoCarga | undefined) ?? "",
      existingId: entry?.id,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editState) return;
    if (editState.fecha_fin < editState.fecha_inicio) {
      toast.error("La fecha fin debe ser posterior o igual a la fecha inicio.");
      return;
    }
    setSaving(true);
    const dates: string[] = [];
    let cur = new Date(editState.fecha_inicio + "T00:00:00");
    const end = new Date(editState.fecha_fin + "T00:00:00");
    while (cur <= end) { dates.push(isoDate(cur)); cur = addDays(cur, 1); }

    const rows = dates.map((f) => ({
      camion_id: editState.truck.id,
      fecha: f,
      estado: editState.estado,
      lugar: editState.lugar.trim() || null,
      destino: editState.destino.trim() || null,
      tipo_carga: editState.tipo_carga || null,
    }));

    const { error } = await (supabase as any)
      .from("disponibilidad_camion")
      .upsert(rows, { onConflict: "camion_id,fecha" });
    setSaving(false);
    if (error) { toast.error("No se pudo guardar: " + error.message); return; }
    toast.success(`Guardado (${rows.length} día${rows.length > 1 ? "s" : ""}).`);
    setEditOpen(false);
    loadAll();
  };

  const deleteEntry = async () => {
    if (!editState?.existingId) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("disponibilidad_camion")
      .delete()
      .eq("id", editState.existingId);
    setSaving(false);
    if (error) { toast.error("No se pudo eliminar: " + error.message); return; }
    toast.success("Entrada eliminada.");
    setEditOpen(false);
    loadAll();
  };

  const saveNewSecondary = async () => {
    if (!addState.nombre.trim() || !addState.tipo.trim()) {
      toast.error("Nombre y tipo de camión son obligatorios.");
      return;
    }
    setAddSaving(true);
    const patente = (addState.patente.trim() || `SEC-${Date.now().toString().slice(-6)}`).toUpperCase();
    const { error } = await (supabase as any).from("trucks").insert({
      user_id: null,
      proveedor_secundario_nombre: addState.nombre.trim(),
      patente,
      tipo: addState.tipo.trim(),
    });
    setAddSaving(false);
    if (error) { toast.error("No se pudo crear: " + error.message); return; }
    toast.success("Proveedor secundario agregado.");
    setAddOpen(false);
    setAddState({ nombre: "", tipo: "", patente: "" });
    loadAll();
  };

  if (isAdmin === null) return <div className="text-sm text-muted-foreground">Cargando…</div>;
  if (!isAdmin) return null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-xl bg-zinc-900 p-3 text-zinc-100 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-amber-400 sm:text-2xl">Disponibilidad de camiones</h1>
            <p className="text-xs text-zinc-400 sm:text-sm">
              Semana del {fmtShort(days[0])} al {fmtShort(days[6])} · {days[0].getFullYear()}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Semana anterior"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 sm:w-auto sm:gap-1 sm:px-3"
            >
              <ChevronLeft className="h-4 w-4" /><span className="hidden sm:inline text-sm">Anterior</span>
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="inline-flex h-9 shrink-0 items-center rounded-md bg-amber-500 px-3 text-sm font-semibold text-zinc-900 hover:bg-amber-400"
            >
              Hoy
            </button>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Semana siguiente"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 sm:w-auto sm:gap-1 sm:px-3"
            >
              <span className="hidden sm:inline text-sm">Siguiente</span><ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="h-9 border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Agregar proveedor secundario</span><span className="sm:hidden">Secundario</span>
          </Button>
          <Select value={filterTipo} onValueChange={setFilterTipo}>
            <SelectTrigger className="h-9 w-[130px] border-zinc-700 bg-zinc-800 text-zinc-100 sm:w-44"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los tipos</SelectItem>
              {tiposDisponibles.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterProveedor} onValueChange={setFilterProveedor}>
            <SelectTrigger className="h-9 w-[150px] border-zinc-700 bg-zinc-800 text-zinc-100 sm:w-56"><SelectValue placeholder="Proveedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los proveedores</SelectItem>
              {proveedoresDisponibles.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Disponible</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> No disponible</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-zinc-600" /> Sin confirmar</span>
          <span className="mx-1 hidden h-3 w-px bg-zinc-700 sm:inline-block" />
          <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3 w-3 text-emerald-400" /> Principal</span>
          <span className="inline-flex items-center gap-1"><UserCog className="h-3 w-3 text-amber-400" /> Secundario</span>
        </div>
      </div>

      <div className="-mx-3 overflow-x-auto rounded-none border-y border-border bg-card sm:mx-0 sm:rounded-lg sm:border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-900 text-zinc-100">
              <th className="sticky left-0 z-20 w-[160px] min-w-[160px] border-r border-zinc-800 bg-zinc-900 px-2 py-2 text-left text-xs font-semibold sm:w-64 sm:min-w-[220px] sm:px-3 sm:text-sm">
                Camión / Proveedor
              </th>
              {days.map((d) => {
                const iso = isoDate(d);
                const isToday = iso === todayIso;
                return (
                  <th key={iso} className={`px-1.5 py-2 text-center text-xs font-semibold sm:px-2 ${isToday ? "bg-amber-500/20 text-amber-300" : ""}`}>
                    <div className="text-[10px] uppercase tracking-wide opacity-80">{DIAS[(d.getDay() + 6) % 7]}</div>
                    <div className="text-xs sm:text-sm">{fmtShort(d)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            ) : trucksFiltered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No hay camiones que coincidan.</td></tr>
            ) : (
              <TooltipProvider delayDuration={150}>
                {trucksFiltered.map((t) => {
                  const isPrincipal = !!t.user_id;
                  return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 w-[160px] min-w-[160px] border-r border-border bg-card px-2 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] sm:w-64 sm:min-w-[220px] sm:px-3">
                      <div className="flex items-start gap-2">
                        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold">{t.patente}</span>
                            {isPrincipal ? (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800" title="Proveedor con cuenta">
                                <BadgeCheck className="h-2.5 w-2.5" /><span className="hidden sm:inline">Principal</span>
                              </span>
                            ) : (
                              <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800" title="Cargado por administración">
                                <UserCog className="h-2.5 w-2.5" /><span className="hidden sm:inline">Secundario</span>
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {proveedorNombre(t)}{t.tipo ? ` · ${t.tipo}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map((d) => {
                      const iso = isoDate(d);
                      const isToday = iso === todayIso;
                      const entry = dispMap.get(`${t.id}|${iso}`);
                      const estado: Estado = entry?.estado ?? "sin_confirmar";
                      const hasInfo = !!(entry?.lugar || entry?.destino || entry?.tipo_carga);
                      const cell = (
                        <button
                          type="button"
                          onClick={() => openEdit(t, iso)}
                          className={`mx-auto flex h-12 w-full min-w-[60px] max-w-[110px] cursor-pointer flex-col items-center justify-center rounded-md px-1 text-[10px] leading-tight transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/60 sm:h-14 sm:text-[11px] ${estadoBg[estado]}`}
                        >
                          {hasInfo ? (
                            <>
                              {entry?.lugar && <span className="max-w-full truncate">{entry.lugar}</span>}
                              {entry?.destino && <span className="max-w-full truncate opacity-90">→ {entry.destino}</span>}
                            </>
                          ) : (
                            <span className="opacity-80">
                              {estado === "sin_confirmar" ? "—" : estado === "disponible" ? "OK" : "No"}
                            </span>
                          )}
                        </button>
                      );
                      return (
                        <td key={iso} className={`px-1 py-1.5 align-middle sm:px-1.5 sm:py-2 ${isToday ? "bg-amber-500/5" : ""}`}>
                          {hasInfo ? (
                            <Tooltip>
                              <TooltipTrigger asChild>{cell}</TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <div className="space-y-0.5">
                                  <div><span className="font-semibold">Estado:</span> {estado.replace("_", " ")}</div>
                                  {entry?.lugar && <div><span className="font-semibold">Lugar:</span> {entry.lugar}</div>}
                                  {entry?.destino && <div><span className="font-semibold">Destino:</span> {entry.destino}</div>}
                                  {entry?.tipo_carga && <div><span className="font-semibold">Carga:</span> {entry.tipo_carga.replace("_", " ")}</div>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : cell}
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </TooltipProvider>
            )}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-muted-foreground">Toca una celda para editar la disponibilidad de ese día o un rango.</p>

      {/* Mapa */}
      <section className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary-dark">Mapa de disponibilidad</h2>
            <p className="text-xs text-muted-foreground">Pines generados desde la tabla de arriba (día seleccionado), coincidiendo el lugar con las ciudades de Chile.</p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mapDay" className="text-xs text-muted-foreground">Día:</Label>
            <select
              id="mapDay"
              value={mapDay}
              onChange={(e) => setMapDay(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              {days.map((d) => {
                const iso = isoDate(d);
                return <option key={iso} value={iso}>{DIAS[(d.getDay() + 6) % 7]} {fmtShort(d)}</option>;
              })}
            </select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {pinData.withLoc.length} en mapa · {pinData.withoutLoc.length} sin ubicación
            </span>
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ height: "55vh", minHeight: 360 }}>
          <MapContainer center={[-35.6751, -71.5430]} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapAutoFit points={points} />
            {pinData.withLoc.map(({ disp, truck, origen, destino }) => {
              const color = PIN_COLORS[disp.estado] ?? PIN_COLORS.sin_confirmar;
              return (
                <div key={disp.id ?? `${disp.camion_id}-${disp.fecha}`}>
                  <Marker position={[Number(origen.lat), Number(origen.lng)]} icon={pinIcon(color)}>
                    <Popup>
                      <div className="text-sm space-y-1 min-w-[180px]">
                        <div className="font-semibold">{truck.patente}{truck.tipo ? ` · ${truck.tipo}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{proveedorNombre(truck)}</div>
                        <div className="text-xs"><b>Estado:</b> {disp.estado.replace("_", " ")}</div>
                        <div className="text-xs"><b>Lugar:</b> {origen.nombre}</div>
                        {(destino || disp.destino) && (
                          <div className="text-xs"><b>Destino:</b> {destino?.nombre ?? disp.destino}</div>
                        )}
                        {disp.tipo_carga && <div className="text-xs"><b>Carga:</b> {disp.tipo_carga.replace("_", " ")}</div>}
                      </div>
                    </Popup>
                  </Marker>
                  {destino && (
                    <Polyline
                      positions={[[Number(origen.lat), Number(origen.lng)], [Number(destino.lat), Number(destino.lng)]]}
                      pathOptions={{ color, weight: 2, opacity: 0.7, dashArray: "6 6" }}
                    />
                  )}
                </div>
              );
            })}
          </MapContainer>
        </div>

        {pinData.withoutLoc.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Sin ubicación en el mapa ({pinData.withoutLoc.length})
            </h3>
            <ul className="divide-y">
              {pinData.withoutLoc.map(({ disp, truck }) => (
                <li key={disp.id ?? `${disp.camion_id}-${disp.fecha}`} className="py-2 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PIN_COLORS[disp.estado] ?? PIN_COLORS.sin_confirmar }} />
                  <span className="font-medium">{truck.patente}</span>
                  <span className="text-xs text-muted-foreground">{proveedorNombre(truck)}</span>
                  <span className="text-xs">{disp.lugar ? `Lugar: ${disp.lugar}` : "Sin lugar"}</span>
                  {disp.destino && <span className="text-xs">→ {disp.destino}</span>}
                  {disp.tipo_carga && <span className="text-xs text-muted-foreground">{disp.tipo_carga.replace("_", " ")}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar disponibilidad</DialogTitle>
            {editState && (
              <DialogDescription>
                {editState.truck.patente} · {proveedorNombre(editState.truck)}
              </DialogDescription>
            )}
          </DialogHeader>
          {editState && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Fecha inicio</Label>
                  <Input type="date" value={editState.fecha_inicio}
                    onChange={(e) => setEditState({ ...editState, fecha_inicio: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha fin</Label>
                  <Input type="date" value={editState.fecha_fin}
                    onChange={(e) => setEditState({ ...editState, fecha_fin: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={editState.estado} onValueChange={(v) => setEditState({ ...editState, estado: v as Estado })}>
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
                  <Label>Lugar</Label>
                  <Input value={editState.lugar}
                    onChange={(e) => setEditState({ ...editState, lugar: e.target.value })}
                    placeholder="Ciudad de origen" />
                </div>
                <div className="space-y-1.5">
                  <Label>Destino</Label>
                  <Input value={editState.destino}
                    onChange={(e) => setEditState({ ...editState, destino: e.target.value })}
                    placeholder="Ciudad de destino" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de carga</Label>
                <Select value={editState.tipo_carga || "__none__"}
                  onValueChange={(v) => setEditState({ ...editState, tipo_carga: v === "__none__" ? "" : (v as TipoCarga) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin especificar</SelectItem>
                    <SelectItem value="consolidando">Consolidando</SelectItem>
                    <SelectItem value="rampla_completa">Rampla completa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div>
              {editState?.existingId && (
                <Button variant="destructive" onClick={deleteEntry} disabled={saving}>
                  <Trash2 className="h-4 w-4" /> Eliminar entrada
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add secondary provider dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar proveedor secundario</DialogTitle>
            <DialogDescription>
              Se crea sin cuenta de acceso. Se registra automáticamente su camión asociado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre del proveedor *</Label>
              <Input value={addState.nombre}
                onChange={(e) => setAddState({ ...addState, nombre: e.target.value })}
                placeholder="Transportes ejemplo" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de camión *</Label>
              <Input value={addState.tipo}
                onChange={(e) => setAddState({ ...addState, tipo: e.target.value })}
                placeholder="Rampla, tres cuartos, etc." />
            </div>
            <div className="space-y-1.5">
              <Label>Patente (opcional)</Label>
              <Input value={addState.patente}
                onChange={(e) => setAddState({ ...addState, patente: e.target.value })}
                placeholder="Se genera automáticamente si se omite" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addSaving}>Cancelar</Button>
            <Button onClick={saveNewSecondary} disabled={addSaving}>{addSaving ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
