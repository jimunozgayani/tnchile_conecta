import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarOperacionesActivas, type OperacionResumen } from "@/lib/operaciones.functions";
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

function OperacionesPage() {
  const { data: me } = useStaffIdentity();
  const roles = me?.roles ?? [];
  const isLeader = roles.includes("admin") || roles.includes("jefe_operaciones");
  const rolLabel = !me
    ? "…"
    : roles.includes("jefe_operaciones")
      ? "Jefe de Operaciones"
      : roles.includes("admin")
        ? "Administrador"
        : "Operador";

  if (isLeader) return <JefeOperacionesView nombre={me?.nombre ?? "…"} rolLabel={rolLabel} />;
  return <OperadorPersonalView nombre={me?.nombre ?? "…"} userId={me?.userId ?? null} rolLabel={rolLabel} />;
}

function JefeOperacionesView({ nombre, rolLabel }: { nombre: string; rolLabel: string }) {
  const listarEquipo = useServerFn(obtenerEquipoOperaciones);
  const listarActividad = useServerFn(obtenerActividadOperaciones);

  const { data: equipo, isLoading } = useQuery({
    queryKey: ["equipo-operaciones"],
    queryFn: () => listarEquipo({ data: {} as never }),
  });
  const { data: actividad, isLoading: loadingAct } = useQuery({
    queryKey: ["actividad-operaciones"],
    queryFn: () => listarActividad({ data: {} as never }),
  });

  return (
    <div className="space-y-6">
      <UserCard nombre={nombre} rolLabel={rolLabel} />

      <TeamTable
        titulo="Mi equipo de operaciones"
        cargando={isLoading}
        filas={equipo ?? []}
        columnas={[
          { label: "Activas", get: (r: MiembroOperaciones) => r.operaciones_activas },
          { label: "Finalizadas (mes)", get: (r: MiembroOperaciones) => r.finalizadas_mes },
        ]}
      />

      <MetasEquipo rol="operador" puedeCrear />

      <ActividadEquipoCard filas={actividad ?? []} cargando={loadingAct} />

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

function OperadorPersonalView({
  nombre,
  userId,
  rolLabel,
}: {
  nombre: string;
  userId: string | null;
  rolLabel: string;
}) {
  const me = { userId, nombre };
  const listarActivas = useServerFn(listarOperacionesActivas);

  const { data } = useQuery({
    enabled: !!me?.userId,
    queryKey: ["operaciones-home", me?.userId],
    queryFn: async () => {
      const base = () =>
        supabase.from("operaciones").select("*", { count: "exact", head: true }).is("deleted_at", null);
      const hoy = new Date().toISOString().slice(0, 10);

      const [enOperacion, finalizadasHoy, listas, activas] = await Promise.all([
        base().eq("estado", "en_operacion"),
        base().eq("estado", "finalizada").gte("updated_at", `${hoy}T00:00:00`),
        base().eq("estado", "lista_para_operar"),
        listarActivas({}),
      ]);

      return {
        enOperacion: enOperacion.count ?? 0,
        finalizadasHoy: finalizadasHoy.count ?? 0,
        listas: listas.count ?? 0,
        activas: (activas as OperacionResumen[]).filter((o) => ACTIVAS.includes(o.estado)),
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
        {(data?.activas ?? []).map((r: OperacionResumen) => (
          <li key={r.id}>
            <Link
              to="/operacion/$id"
              params={{ id: r.id }}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  N° {r.numero_operacion} · {r.contacto_nombre ?? "Sin contacto"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.origen ?? "Sin origen"} → {r.destino ?? "Sin destino"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <EstadoBadge estado={r.estado} />
                <span className="text-xs text-muted-foreground">{formatFecha(r.fecha_carga)}</span>
              </div>
            </Link>
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
