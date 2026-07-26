import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin } from "lucide-react";
import { rowTipo, type DayRow } from "@/components/DayDetailPanel";

const PIN_COLORS: Record<string, string> = {
  disponible: "#059669",
  no_disponible: "#dc2626",
};

function pinIcon(color: string, highlighted: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:28px;height:36px;${highlighted ? "transform:scale(1.25);transform-origin:bottom center;" : ""}">
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
    if (points.length === 1) {
      map.setView(points[0], 7);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [points, map]);
  return null;
}

/** Pans to the row selected in the list so list and map stay in sync. */
function MapFocus({ point }: { point: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, Math.max(map.getZoom(), 7), { animate: true });
  }, [point, map]);
  return null;
}

type Located = { row: DayRow; lat: number; lng: number; dest: { lat: number; lng: number; nombre: string } | null };

/**
 * Map for the availability day panel. Renders exactly the rows it receives —
 * the page passes the same filtered array used by the list.
 */
export function DisponibilidadMap({
  rows,
  selectedDriverId,
  onSelectDriver,
}: {
  rows: DayRow[];
  selectedDriverId: string | null;
  onSelectDriver: (driverId: string) => void;
}) {
  const { located, unlocated } = useMemo(() => {
    const located: Located[] = [];
    const unlocated: DayRow[] = [];
    for (const r of rows) {
      if (r.estado === "sin_confirmar") continue;
      const lugar = r.disp?.lugar;
      if (lugar?.lat != null && lugar?.lng != null) {
        const d = r.disp?.destino;
        located.push({
          row: r,
          lat: Number(lugar.lat),
          lng: Number(lugar.lng),
          dest:
            d?.lat != null && d?.lng != null
              ? { lat: Number(d.lat), lng: Number(d.lng), nombre: d.nombre }
              : null,
        });
      } else {
        unlocated.push(r);
      }
    }
    return { located, unlocated };
  }, [rows]);

  const points = useMemo<[number, number][]>(
    () => located.map((x) => [x.lat, x.lng]),
    [located],
  );

  const focus = useMemo<[number, number] | null>(() => {
    const hit = located.find((x) => x.row.driver_id === selectedDriverId);
    return hit ? [hit.lat, hit.lng] : null;
  }, [located, selectedDriverId]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> No disponible
        </span>
        <span>
          {located.length} en el mapa · {unlocated.length} sin ubicación
        </span>
      </div>

      <div
        className="overflow-hidden rounded-xl border shadow-sm"
        style={{ height: "55vh", minHeight: 340 }}
      >
        <MapContainer
          center={[-35.6751, -71.543]}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapAutoFit points={points} />
          <MapFocus point={focus} />
          {located.map(({ row, lat, lng, dest }) => {
            const color = PIN_COLORS[row.estado] ?? PIN_COLORS.disponible;
            const active = row.driver_id === selectedDriverId;
            return (
              <div key={row.driver_id}>
                <Marker
                  position={[lat, lng]}
                  icon={pinIcon(color, active)}
                  eventHandlers={{ click: () => onSelectDriver(row.driver_id) }}
                >
                  <Popup>
                    <div className="min-w-[190px] space-y-1 text-sm">
                      <div className="font-semibold">{row.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.proveedor ??
                          (row.origen_registro === "operaciones" ? "Ocasional" : "Sin proveedor")}
                      </div>
                      {rowTipo(row) && (
                        <div className="text-xs">
                          <b>Camión:</b> {rowTipo(row)}
                        </div>
                      )}
                      <div className="text-xs">
                        <b>Estado:</b> {row.estado.replace("_", " ")}
                      </div>
                      <div className="text-xs">
                        <b>Lugar:</b> {row.disp?.lugar?.nombre}
                      </div>
                      {dest && (
                        <div className="text-xs">
                          <b>Destino:</b> {dest.nombre}
                        </div>
                      )}
                      {row.disp?.modalidad && (
                        <div className="text-xs">
                          <b>Carga:</b>{" "}
                          {row.disp.modalidad === "consolidado" ? "Consolidado" : "Rampla completa"}
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
                {dest && (
                  <Polyline
                    positions={[
                      [lat, lng],
                      [dest.lat, dest.lng],
                    ]}
                    pathOptions={{ color, weight: 2, opacity: 0.7, dashArray: "6 6" }}
                  />
                )}
              </div>
            );
          })}
        </MapContainer>
      </div>

      {unlocated.length > 0 && (
        <div className="rounded-xl border bg-card p-3 shadow-sm">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Sin ubicación en el mapa ({unlocated.length})
          </h3>
          <ul className="divide-y">
            {unlocated.map((r) => (
              <li
                key={r.driver_id}
                onClick={() => onSelectDriver(r.driver_id)}
                className="flex cursor-pointer flex-wrap items-center gap-2 py-2 text-sm"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: PIN_COLORS[r.estado] ?? "#a1a1aa" }}
                />
                <span className="font-medium">{r.nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {r.proveedor ?? "Sin proveedor"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.disp?.lugar_texto ? `Lugar: ${r.disp.lugar_texto}` : "Sin lugar"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
