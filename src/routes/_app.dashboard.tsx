import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Truck, Users, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { diasHasta } from "@/lib/regions";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

type Alerta = { tipo: string; entidad: string; vencimiento: string; dias: number };

function Dashboard() {
  const [stats, setStats] = useState({ camiones: 0, choferes: 0, porVencer: 0, vencidos: 0 });
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: trucks }, { data: drivers }] = await Promise.all([
        supabase.from("trucks").select("*").is("deleted_at", null),
        supabase.from("drivers").select("*").is("deleted_at", null),
      ]);

      const items: Alerta[] = [];
      (trucks ?? []).forEach((t: any) => {
        [
          ["SOAP", t.soap_vencimiento],
          ["Permiso circulación", t.permiso_circulacion_vencimiento],
          ["Revisión técnica", t.revision_tecnica_vencimiento],
        ].forEach(([tipo, f]) => {
          const d = diasHasta(f as string);
          if (d !== null && d <= 30)
            items.push({ tipo: tipo as string, entidad: `Camión ${t.patente}`, vencimiento: f as string, dias: d });
        });
      });
      (drivers ?? []).forEach((dr: any) => {
        [
          ["Licencia", dr.licencia_vencimiento],
          ["Carnet identidad", dr.carnet_vencimiento],
        ].forEach(([tipo, f]) => {
          const d = diasHasta(f as string);
          if (d !== null && d <= 30)
            items.push({ tipo: tipo as string, entidad: dr.nombre_completo, vencimiento: f as string, dias: d });
        });
      });

      items.sort((a, b) => a.dias - b.dias);
      setAlertas(items);
      setStats({
        camiones: trucks?.length ?? 0,
        choferes: drivers?.length ?? 0,
        porVencer: items.filter((i) => i.dias >= 0 && i.dias <= 30).length,
        vencidos: items.filter((i) => i.dias < 0).length,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Total camiones", value: stats.camiones, icon: Truck, color: "text-primary" },
    { label: "Total choferes", value: stats.choferes, icon: Users, color: "text-primary" },
    { label: "Por vencer (≤30 días)", value: stats.porVencer, icon: Clock, color: "text-warning-foreground" },
    { label: "Vencidos", value: stats.vencidos, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Panel de Control</h1>
        <p className="text-muted-foreground">Resumen de tu actividad como proveedor.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold">{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Alertas de vencimiento</h2>
          <p className="text-sm text-muted-foreground">Documentos con menos de 30 días para vencer o ya vencidos.</p>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-muted-foreground">Cargando...</div>
        ) : alertas.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">No hay alertas. ¡Todo al día!</div>
        ) : (
          <ul className="divide-y">
            {alertas.map((a, i) => {
              const style =
                a.dias < 0
                  ? "bg-destructive/15 text-destructive"
                  : a.dias <= 15
                  ? "bg-orange/20 text-orange"
                  : "bg-warning/30 text-warning-foreground";
              const texto =
                a.dias < 0 ? `Vencido hace ${Math.abs(a.dias)} d` : `${a.dias} d restantes`;
              return (
                <li key={i} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="font-medium">{a.entidad}</p>
                    <p className="text-sm text-muted-foreground">{a.tipo} · vence {a.vencimiento}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${style}`}>
                    {texto}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
