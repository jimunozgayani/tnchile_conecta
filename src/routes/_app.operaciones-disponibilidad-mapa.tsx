import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Users, CalendarDays } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/operaciones-disponibilidad-mapa")({
  head: () => pageHead("/operaciones-disponibilidad-mapa", "Disponibilidad de choferes · Operaciones TN Chile", "Mapa y listado de disponibilidad de choferes para planificar asignaciones de carga en TN Chile."),
  component: DisponibilidadOperacionesPage,
});

type Estado = "disponible" | "no_disponible";
type Modalidad = "consolidado" | "rampla_completa";

type Ciudad = { id: string; nombre: string; region: string | null; lat: number; lng: number };

type DispRow = {
  id: string;
  driver_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  estado: Estado;
  lugar_ciudad_id: string | null;
  lugar_texto: string | null;
  destino_ciudad_id: string | null;
  destino_texto: string | null;
  modalidad: Modalidad | null;
  truck_id: string | null;
  notas: string | null;
  lugar: { nombre: string; lat: number; lng: number } | null;
  destino: { nombre: string; lat: number; lng: number } | null;
  truck: { patente: string; tipo: string | null } | null;
  drivers: {
    id: string;
    nombre_completo: string;
    user_id: string | null;
    clase_licencia: string | null;
  } | null;
};

type ProfileMap = Record<string, string>;

const PIN_COLORS: Record<Estado, string> = {
  disponible: "#059669",
  no_disponible: "#dc2626",
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

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function DisponibilidadOperacionesPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<DispRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [loading, setLoading] = useState(true);

  const [filterEstado, setFilterEstado] = useState<string>("__all__");
  const [filterModalidad, setFilterModalidad] = useState<string>("__all__");
  const [filterProveedor, setFilterProveedor] = useState<string>("__all__");
  const [day, setDay] = useState<string>(() => isoDate(new Date()));

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
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      // Fetch entries that overlap the selected day
      const { data, error } = await supabase
        .from("disponibilidad_chofer")
        .select("*, lugar:lugar_ciudad_id(nombre, lat, lng), destino:destino_ciudad_id(nombre, lat, lng), truck:truck_id(patente, tipo), drivers!inner(id, nombre_completo, user_id, clase_licencia)")
        .lte("fecha_desde", day)
        .gte("fecha_hasta", day)
        .order("fecha_desde", { ascending: false });
      if (error) { console.error(error); setRows([]); setLoading(false); return; }
      const list = (data ?? []) as unknown as DispRow[];
      setRows(list);

      const userIds = Array.from(new Set(list.map((r) => r.drivers?.user_id).filter(Boolean))) as string[];
      if (userIds.length) {
        const { data: p } = await supabase.from("profiles").select("id, razon_social, nombre_contacto").in("id", userIds);
        const map: ProfileMap = {};
        (p ?? []).forEach((x: any) => { map[x.id] = x.razon_social || x.nombre_contacto || "Proveedor"; });
        setProfiles(map);
      } else setProfiles({});
      setLoading(false);
    })();
  }, [isAdmin, day]);

  const proveedorNombre = (r: DispRow) =>
    r.drivers?.user_id ? (profiles[r.drivers.user_id] ?? "Proveedor") : "Sin proveedor";

  const modalidadesDisponibles = useMemo(
    () => Array.from(new Set(rows.map((r) => r.modalidad).filter(Boolean))) as string[],
    [rows],
  );
  const proveedoresDisponibles = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(proveedorNombre(r)));
    return Array.from(s).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, profiles]);

  const rowsFiltered = useMemo(
    () => rows.filter((r) =>
      (filterEstado === "__all__" || r.estado === filterEstado) &&
      (filterModalidad === "__all__" || r.modalidad === filterModalidad) &&
      (filterProveedor === "__all__" || proveedorNombre(r) === filterProveedor)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, filterEstado, filterModalidad, filterProveedor, profiles],
  );

  const pinData = useMemo(() => {
    const withLoc: Array<{ r: DispRow; origen: Ciudad; destino: Ciudad | null }> = [];
    const withoutLoc: DispRow[] = [];
    for (const r of rowsFiltered) {
      if (r.lugar) {
        const origen: Ciudad = { id: r.lugar_ciudad_id!, nombre: r.lugar.nombre, region: null, lat: r.lugar.lat, lng: r.lugar.lng };
        const destino: Ciudad | null = r.destino
          ? { id: r.destino_ciudad_id!, nombre: r.destino.nombre, region: null, lat: r.destino.lat, lng: r.destino.lng }
          : null;
        withLoc.push({ r, origen, destino });
      } else {
        withoutLoc.push(r);
      }
    }
    return { withLoc, withoutLoc };
  }, [rowsFiltered]);

  const points: [number, number][] = pinData.withLoc.map((x) => [Number(x.origen.lat), Number(x.origen.lng)]);

  if (isAdmin === null) return <div className="text-sm text-muted-foreground">Cargando…</div>;
  if (!isAdmin) return null;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="rounded-xl bg-zinc-900 p-3 text-zinc-100 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-amber-400 sm:text-2xl">Disponibilidad de choferes</h1>
            <p className="text-xs text-zinc-400 sm:text-sm">
              Choferes con disponibilidad activa para el día seleccionado.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="mapDay" className="text-xs text-zinc-400">Día:</Label>
            <input
              id="mapDay"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-9 rounded-md border border-zinc-700 bg-zinc-800 px-2 text-sm text-zinc-100"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="h-9 w-[150px] border-zinc-700 bg-zinc-800 text-zinc-100 sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los estados</SelectItem>
              <SelectItem value="disponible">Disponible</SelectItem>
              <SelectItem value="no_disponible">No disponible</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterModalidad} onValueChange={setFilterModalidad}>
            <SelectTrigger className="h-9 w-[150px] border-zinc-700 bg-zinc-800 text-zinc-100 sm:w-44"><SelectValue placeholder="Tipo de carga" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los tipos</SelectItem>
              {modalidadesDisponibles.map((m) => (
                <SelectItem key={m} value={m}>{m === "consolidado" ? "Consolidado" : "Rampla completa"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterProveedor} onValueChange={setFilterProveedor}>
            <SelectTrigger className="h-9 w-[160px] border-zinc-700 bg-zinc-800 text-zinc-100 sm:w-56"><SelectValue placeholder="Proveedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los proveedores</SelectItem>
              {proveedoresDisponibles.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Disponible</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> No disponible</span>
          <span className="mx-1 hidden h-3 w-px bg-zinc-700 sm:inline-block" />
          <span>{rowsFiltered.length} chofer{rowsFiltered.length === 1 ? "" : "es"} · {pinData.withLoc.length} en mapa</span>
        </div>
      </div>

      {/* Mapa */}
      <section className="space-y-2">
        <div className="rounded-xl border overflow-hidden shadow-sm" style={{ height: "55vh", minHeight: 360 }}>
          <MapContainer center={[-35.6751, -71.5430]} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapAutoFit points={points} />
            {pinData.withLoc.map(({ r, origen, destino }) => {
              const color = PIN_COLORS[r.estado] ?? PIN_COLORS.disponible;
              return (
                <div key={r.id}>
                  <Marker position={[Number(origen.lat), Number(origen.lng)]} icon={pinIcon(color)}>
                    <Popup>
                      <div className="text-sm space-y-1 min-w-[200px]">
                        <div className="font-semibold">{r.drivers?.nombre_completo ?? "Chofer"}</div>
                        <div className="text-xs text-muted-foreground">{proveedorNombre(r)}</div>
                        {r.drivers?.clase_licencia && (
                          <div className="text-xs text-muted-foreground">Licencia {r.drivers.clase_licencia}</div>
                        )}
                        <div className="text-xs"><b>Estado:</b> {r.estado.replace("_", " ")}</div>
                        <div className="text-xs"><b>Vigencia:</b> {r.fecha_desde} → {r.fecha_hasta}</div>
                        <div className="text-xs"><b>Lugar:</b> {origen.nombre}</div>
                        {destino && <div className="text-xs"><b>Destino:</b> {destino.nombre}</div>}
                        {r.modalidad && <div className="text-xs"><b>Carga:</b> {r.modalidad === "consolidado" ? "Consolidado" : "Rampla completa"}</div>}
                        {r.truck?.patente && <div className="text-xs"><b>Camión:</b> {r.truck.patente}</div>}
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

        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {!loading && rowsFiltered.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay choferes con disponibilidad para el día y filtros seleccionados.
          </div>
        )}

        {pinData.withoutLoc.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Sin ubicación en el mapa ({pinData.withoutLoc.length})
            </h3>
            <ul className="divide-y">
              {pinData.withoutLoc.map((r) => (
                <li key={r.id} className="py-2 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: PIN_COLORS[r.estado] }} />
                  <span className="inline-flex items-center gap-1 font-medium"><Users className="h-3.5 w-3.5 text-primary" />{r.drivers?.nombre_completo ?? "Chofer"}</span>
                  <span className="text-xs text-muted-foreground">{proveedorNombre(r)}</span>
                  <span className="text-xs inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{r.fecha_desde} → {r.fecha_hasta}</span>
                  <span className="text-xs">{r.lugar_texto ? `Lugar: ${r.lugar_texto}` : "Sin lugar"}</span>
                  {r.destino_texto && <span className="text-xs">→ {r.destino_texto}</span>}
                  {r.modalidad && <span className="text-xs text-muted-foreground">{r.modalidad === "consolidado" ? "Consolidado" : "Rampla completa"}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
