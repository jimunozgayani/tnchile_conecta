import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const Route = createFileRoute("/_app/disponibilidad-camiones")({
  component: DisponibilidadCamionesPage,
});

type Estado = "disponible" | "no_disponible" | "sin_confirmar";

type TruckRow = { id: string; patente: string; marca: string | null; modelo: string | null; tipo: string | null };

type Disp = {
  camion_id: string;
  fecha: string;
  estado: Estado;
  lugar: string | null;
  destino: string | null;
  tipo_carga: string | null;
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtShort(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const estadoBg: Record<Estado, string> = {
  disponible: "bg-emerald-500/90 text-white hover:bg-emerald-500",
  no_disponible: "bg-red-500/90 text-white hover:bg-red-500",
  sin_confirmar: "bg-zinc-200 text-zinc-600 hover:bg-zinc-300",
};

function DisponibilidadCamionesPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const [disps, setDisps] = useState<Disp[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const { data: t } = await supabase
        .from("trucks")
        .select("id, patente, marca, modelo, tipo")
        .is("deleted_at", null)
        .order("patente");
      setTrucks((t ?? []) as TruckRow[]);

      const from = isoDate(days[0]);
      const to = isoDate(days[6]);
      const { data: d } = await (supabase as any)
        .from("disponibilidad_camion")
        .select("camion_id, fecha, estado, lugar, destino, tipo_carga")
        .gte("fecha", from)
        .lte("fecha", to);
      setDisps((d ?? []) as Disp[]);
      setLoading(false);
    })();
  }, [isAdmin, weekStart]);

  const map = useMemo(() => {
    const m = new Map<string, Disp>();
    for (const d of disps) m.set(`${d.camion_id}|${d.fecha}`, d);
    return m;
  }, [disps]);

  if (isAdmin === null) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!isAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-primary">Disponibilidad de camiones</h1>
          <p className="text-sm text-muted-foreground">
            Semana del {fmtShort(days[0])} al {fmtShort(days[6])} · {days[0].getFullYear()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
          >
            Hoy
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="inline-flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-500" /> Disponible</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-500" /> No disponible</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-zinc-300" /> Sin confirmar</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 w-56 bg-muted/50 px-3 py-2 text-left font-semibold">Camión</th>
              {days.map((d) => {
                const iso = isoDate(d);
                const isToday = iso === todayIso;
                return (
                  <th
                    key={iso}
                    className={`px-2 py-2 text-center font-semibold ${isToday ? "bg-primary/15 text-primary" : ""}`}
                  >
                    <div className="text-xs uppercase tracking-wide">{DIAS[(d.getDay() + 6) % 7]}</div>
                    <div className="text-sm">{fmtShort(d)}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">Cargando…</td></tr>
            ) : trucks.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No hay camiones registrados.</td></tr>
            ) : (
              <TooltipProvider delayDuration={150}>
                {trucks.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="sticky left-0 z-10 w-56 bg-card px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-primary" />
                        <div>
                          <div className="font-semibold">{t.patente}</div>
                          <div className="text-xs text-muted-foreground">
                            {[t.marca, t.modelo].filter(Boolean).join(" ") || t.tipo || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    {days.map((d) => {
                      const iso = isoDate(d);
                      const isToday = iso === todayIso;
                      const entry = map.get(`${t.id}|${iso}`);
                      const estado: Estado = entry?.estado ?? "sin_confirmar";
                      const hasInfo = !!(entry?.lugar || entry?.destino || entry?.tipo_carga);
                      const cell = (
                        <div
                          className={`mx-auto flex h-14 min-w-[80px] cursor-default flex-col items-center justify-center rounded-md px-1.5 text-[11px] leading-tight transition-colors ${estadoBg[estado]}`}
                        >
                          {hasInfo ? (
                            <>
                              {entry?.lugar && <span className="max-w-full truncate">{entry.lugar}</span>}
                              {entry?.destino && <span className="max-w-full truncate opacity-90">→ {entry.destino}</span>}
                            </>
                          ) : (
                            <span className="opacity-80">
                              {estado === "sin_confirmar" ? "—" : estado === "disponible" ? "Disponible" : "No disp."}
                            </span>
                          )}
                        </div>
                      );
                      return (
                        <td key={iso} className={`px-1.5 py-2 align-middle ${isToday ? "bg-primary/5" : ""}`}>
                          {hasInfo ? (
                            <Tooltip>
                              <TooltipTrigger asChild>{cell}</TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <div className="space-y-0.5">
                                  <div><span className="font-semibold">Estado:</span> {estado.replace("_", " ")}</div>
                                  {entry?.lugar && <div><span className="font-semibold">Lugar:</span> {entry.lugar}</div>}
                                  {entry?.destino && <div><span className="font-semibold">Destino:</span> {entry.destino}</div>}
                                  {entry?.tipo_carga && <div><span className="font-semibold">Carga:</span> {entry.tipo_carga}</div>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </TooltipProvider>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">Vista de solo lectura.</p>
    </div>
  );
}
