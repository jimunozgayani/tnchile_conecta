import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pageHead } from "@/lib/page-head";
import { requireOperations } from "@/lib/require-admin";
import { supabase } from "@/integrations/supabase/client";
import { useStaffIdentity } from "@/hooks/useStaffIdentity";
import {
  EstadoBadge,
  MetasCard,
  MisDocumentos,
  SectionCard,
  StatCard,
  UserCard,
  formatFecha,
  primerDestino,
} from "@/components/staff-home";

export const Route = createFileRoute("/_app/operaciones")({
  head: () =>
    pageHead(
      "/operaciones",
      "Inicio Operaciones · TN Chile",
      "Panel personalizado del equipo de operaciones TN Chile: cargas en operación, finalizadas del día y operaciones activas.",
    ),
  // Supabase session lives in localStorage; gate must run client-side only.
  ssr: false,
  beforeLoad: requireOperations,
  component: OperacionesPage,
});

const ACTIVAS = ["lista_para_operar", "confirmada", "en_operacion"];

type Row = {
  id: string;
  contacto_nombre: string | null;
  origen: string | null;
  destinos: unknown;
  estado: string;
  fecha_despacho: string | null;
};

function OperacionesPage() {
  const { data: me } = useStaffIdentity();
  const roles = me?.roles ?? [];
  const rolLabel = roles.includes("jefe_operaciones")
    ? "Jefe de Operaciones"
    : roles.includes("admin")
      ? "Administrador"
      : "Operador";

  const { data } = useQuery({
    enabled: !!me?.userId,
    queryKey: ["operaciones-home", me?.userId],
    queryFn: async () => {
      const base = () =>
        supabase.from("cotizaciones").select("*", { count: "exact", head: true });
      const hoy = new Date().toISOString().slice(0, 10);

      const [enOperacion, finalizadasHoy, listas, rows] = await Promise.all([
        base().eq("estado", "en_operacion"),
        base().eq("estado", "finalizada").gte("updated_at", `${hoy}T00:00:00`),
        base().eq("estado", "lista_para_operar"),
        supabase
          .from("cotizaciones")
          .select("id, contacto_nombre, origen, destinos, estado, fecha_despacho")
          .in("estado", ACTIVAS)
          .order("fecha_despacho", { ascending: true })
          .limit(8),
      ]);

      return {
        enOperacion: enOperacion.count ?? 0,
        finalizadasHoy: finalizadasHoy.count ?? 0,
        listas: listas.count ?? 0,
        activas: (rows.data ?? []) as Row[],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <UserCard nombre={me?.nombre ?? "…"} rolLabel={rolLabel} />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="En operación ahora" value={data?.enOperacion ?? null} />
          <StatCard label="Finalizadas hoy" value={data?.finalizadasHoy ?? null} />
          <StatCard label="Lista para operar" value={data?.listas ?? null} />
        </div>
      </div>

      <MetasCard />

      <SectionCard
        title="Operaciones activas"
        linkTo="/operaciones-asignaciones"
        empty={(data?.activas.length ?? 0) === 0}
      >
        {(data?.activas ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.contacto_nombre ?? "Sin contacto"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {r.origen ?? "Sin origen"} → {primerDestino(r.destinos)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <EstadoBadge estado={r.estado} />
              <span className="text-xs text-muted-foreground">{formatFecha(r.fecha_despacho)}</span>
            </div>
          </li>
        ))}
      </SectionCard>

      <MisDocumentos />

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <Link to="/operaciones-cotizaciones" className="text-primary hover:underline">
          Cotizaciones
        </Link>
        <Link to="/operaciones-disponibilidad" className="text-primary hover:underline">
          Disponibilidad
        </Link>
        <Link to="/operaciones-asignaciones" className="text-primary hover:underline">
          Asignaciones
        </Link>
      </div>
    </div>
  );
}
