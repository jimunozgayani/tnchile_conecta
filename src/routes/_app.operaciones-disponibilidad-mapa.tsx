import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, MapPin, Filter, Calendar } from "lucide-react";

export const Route = createFileRoute("/_app/operaciones-disponibilidad-mapa")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: any) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: MapaDisponibilidad,
});

type Ciudad = { id: string; nombre: string; region: string | null; lat: number; lng: number };
type Driver = { id: string; nombre_completo: string; user_id: string };
type Profile = { id: string; razon_social: string | null; correo: string | null };
type Disp = {
  id: string; driver_id: string; estado: string; fecha_desde: string; fecha_hasta: string | null;
  lugar_ciudad_id: string | null; lugar_texto: string | null;
  destino_ciudad_id: string | null; destino_texto: string | null;
  modalidad: string | null; truck_id: string | null; notas: string | null;
};
type Truck = { id: string; patente: string; tipo: string | null };

const COLORS: Record<string, string> = {
  disponible: "#059669",
  no_disponible: "#dc2626",
  sin_confirmar: "#71717a",
};
const LABELS: Record<string, string> = {
  disponible: "Disponible",
  no_disponible: "No disponible",
  sin_confirmar: "Sin confirmar",
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

function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }
function parseDate(s: string) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function shiftDay(s: string, delta: number) { const d = parseDate(s); d.setDate(d.getDate()+delta); return fmtDate(d); }

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

function MapaDisponibilidad() {
  const [fecha, setFecha] = useState(fmtDate(new Date()));
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [disp, setDisp] = useState<Disp[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroProveedor, setFiltroProveedor] = useState<string>("all");
  const [filtroModalidad, setFiltroModalidad] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const [c, d, p, t] = await Promise.all([
        supabase.from("ciudades_chile").select("id,nombre,region,lat,lng"),
        supabase.from("drivers").select("id,nombre_completo,user_id").is("deleted_at", null),
        supabase.from("profiles").select("id,razon_social,correo"),
        supabase.from("trucks").select("id,patente,tipo").is("deleted_at", null),
      ]);
      setCiudades((c.data ?? []) as any);
      setDrivers((d.data ?? []) as any);
      setProfiles((p.data ?? []) as any);
      setTrucks((t.data ?? []) as any);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("disponibilidad_chofer")
        .select("id,driver_id,estado,fecha_desde,fecha_hasta,lugar_ciudad_id,lugar_texto,destino_ciudad_id,destino_texto,modalidad,truck_id,notas")
        .lte("fecha_desde", fecha);
      const rows = ((data ?? []) as Disp[]).filter((r) => {
        const to = r.fecha_hasta ?? r.fecha_desde;
        return fecha >= r.fecha_desde && fecha <= to;
      });
      setDisp(rows);
      setLoading(false);
    })();
  }, [fecha]);

  const ciudadMap = useMemo(() => new Map(ciudades.map((c) => [c.id, c])), [ciudades]);
  const driverMap = useMemo(() => new Map(drivers.map((d) => [d.id, d])), [drivers]);
  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const truckMap = useMemo(() => new Map(trucks.map((t) => [t.id, t])), [trucks]);

  const providersInView = useMemo(() => {
    const ids = new Set<string>();
    for (const r of disp) { const d = driverMap.get(r.driver_id); if (d) ids.add(d.user_id); }
    return Array.from(ids).map((id) => profileMap.get(id)).filter(Boolean) as Profile[];
  }, [disp, driverMap, profileMap]);

  const filtered = disp.filter((r) => {
    const d = driverMap.get(r.driver_id);
    if (!d) return false;
    if (filtroProveedor !== "all" && d.user_id !== filtroProveedor) return false;
    if (filtroModalidad !== "all" && (r.modalidad ?? "") !== filtroModalidad) return false;
    return true;
  });

  const conUbicacion = filtered.filter((r) => r.lugar_ciudad_id && ciudadMap.has(r.lugar_ciudad_id));
  const sinUbicacion = filtered.filter((r) => !r.lugar_ciudad_id || !ciudadMap.has(r.lugar_ciudad_id));

  const points: [number, number][] = conUbicacion.map((r) => {
    const c = ciudadMap.get(r.lugar_ciudad_id!)!;
    return [Number(c.lat), Number(c.lng)];
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-primary-dark">Mapa de disponibilidad</h1>
        <p className="text-sm text-muted-foreground">Choferes con disponibilidad cargada para el día seleccionado.</p>
      </header>

      {/* Controles */}
      <div className="rounded-xl border bg-card p-3 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setFecha(shiftDay(fecha, -1))} className="rounded-md border p-2 hover:bg-muted" aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 flex items-center gap-2 rounded-md border px-2 py-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full bg-transparent outline-none text-sm" />
          </div>
          <button onClick={() => setFecha(shiftDay(fecha, 1))} className="rounded-md border p-2 hover:bg-muted" aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setFecha(fmtDate(new Date()))} className="text-xs rounded-md border px-2 py-1.5 hover:bg-muted whitespace-nowrap">Hoy</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)} className="w-full text-sm border rounded-md px-2 py-1.5">
              <option value="all">Todos los proveedores</option>
              {providersInView.map((p) => (
                <option key={p.id} value={p.id}>{p.razon_social || p.correo || p.id.slice(0, 8)}</option>
              ))}
            </select>
          </div>
          <select value={filtroModalidad} onChange={(e) => setFiltroModalidad(e.target.value)} className="w-full text-sm border rounded-md px-2 py-1.5">
            <option value="all">Todas las modalidades</option>
            <option value="consolidando">Consolidando</option>
            <option value="rampla_completa">Rampla completa</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {Object.entries(LABELS).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[k] }} />{v}
            </span>
          ))}
          <span className="ml-auto">{loading ? "Cargando…" : `${conUbicacion.length} en mapa · ${sinUbicacion.length} sin ubicación`}</span>
        </div>
      </div>

      {/* Mapa */}
      <div className="rounded-xl border overflow-hidden shadow-sm" style={{ height: "60vh", minHeight: 380 }}>
        <MapContainer center={[-35.6751, -71.5430]} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapAutoFit points={points} />
          {conUbicacion.map((r) => {
            const c = ciudadMap.get(r.lugar_ciudad_id!)!;
            const dest = r.destino_ciudad_id ? ciudadMap.get(r.destino_ciudad_id) : null;
            const drv = driverMap.get(r.driver_id);
            const prov = drv ? profileMap.get(drv.user_id) : null;
            const truck = r.truck_id ? truckMap.get(r.truck_id) : null;
            const color = COLORS[r.estado] ?? COLORS.sin_confirmar;
            return (
              <div key={r.id}>
                <Marker position={[Number(c.lat), Number(c.lng)]} icon={pinIcon(color)}>
                  <Popup>
                    <div className="text-sm space-y-1 min-w-[180px]">
                      <div className="font-semibold">{drv?.nombre_completo ?? "Chofer"}</div>
                      <div className="text-xs text-muted-foreground">{prov?.razon_social || prov?.correo || "—"}</div>
                      <div className="text-xs"><b>Estado:</b> {LABELS[r.estado] ?? r.estado}</div>
                      {truck && <div className="text-xs"><b>Camión:</b> {truck.patente}{truck.tipo ? ` · ${truck.tipo}` : ""}</div>}
                      {r.modalidad && <div className="text-xs"><b>Modalidad:</b> {r.modalidad.replace("_", " ")}</div>}
                      <div className="text-xs"><b>Lugar:</b> {c.nombre}</div>
                      {(dest || r.destino_texto) && <div className="text-xs"><b>Destino:</b> {dest?.nombre ?? r.destino_texto}</div>}
                    </div>
                  </Popup>
                </Marker>
                {dest && (
                  <Polyline
                    positions={[[Number(c.lat), Number(c.lng)], [Number(dest.lat), Number(dest.lng)]]}
                    pathOptions={{ color, weight: 2, opacity: 0.7, dashArray: "6 6" }}
                  />
                )}
              </div>
            );
          })}
        </MapContainer>
      </div>

      {/* Sin ubicación */}
      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          Sin ubicación en el mapa ({sinUbicacion.length})
        </h2>
        {sinUbicacion.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todos los choferes filtrados tienen ubicación mapeable.</p>
        ) : (
          <ul className="divide-y">
            {sinUbicacion.map((r) => {
              const drv = driverMap.get(r.driver_id);
              const prov = drv ? profileMap.get(drv.user_id) : null;
              const truck = r.truck_id ? truckMap.get(r.truck_id) : null;
              return (
                <li key={r.id} className="py-2 text-sm flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLORS[r.estado] ?? COLORS.sin_confirmar }} />
                  <span className="font-medium">{drv?.nombre_completo ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{prov?.razon_social || prov?.correo || "—"}</span>
                  <span className="text-xs">{r.lugar_texto ? `Lugar: ${r.lugar_texto}` : "Sin lugar"}</span>
                  {(r.destino_texto || r.destino_ciudad_id) && (
                    <span className="text-xs">→ {r.destino_ciudad_id ? ciudadMap.get(r.destino_ciudad_id)?.nombre : r.destino_texto}</span>
                  )}
                  {r.modalidad && <span className="text-xs text-muted-foreground">{r.modalidad.replace("_", " ")}</span>}
                  {truck && <span className="text-xs text-muted-foreground">{truck.patente}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
