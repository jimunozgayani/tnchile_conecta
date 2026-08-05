import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { pageHead } from "@/lib/page-head";
import { requireCommercial } from "@/lib/require-admin";
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
  relativeDays,
} from "@/components/staff-home";

export const Route = createFileRoute("/_app/comercial")({
  head: () =>
    pageHead(
      "/comercial",
      "Inicio Comercial · TN Chile",
      "Panel personalizado del equipo comercial de TN Chile: cotizaciones activas, solicitudes sin asignar y metas del período.",
    ),
  // La sesión de Supabase vive en localStorage: el gate corre solo en el cliente.
  ssr: false,
  beforeLoad: requireCommercial,
  component: ComercialPage,
});

const CERRADAS = ["cerrada", "rechazada"];
const NUEVAS = ["nueva", "pendiente"];

type Row = {
  id: string;
  contacto_nombre: string | null;
  origen: string | null;
  destinos: unknown;
  estado: string;
  fecha_despacho: string | null;
  created_at: string;
};

function ComercialPage() {
  const { data: me } = useStaffIdentity();
  const roles = me?.roles ?? [];
  const isLeader = roles.includes("admin") || roles.includes("lider_cuenta");
  const userId = me?.userId ?? null;
  const rolLabel = !me
    ? "…"
    : roles.includes("lider_cuenta")
      ? "Líder de Cuenta"
      : roles.includes("admin")
        ? "Administrador"
        : "Ejecutivo Comercial";

  if (isLeader) return <LiderCuentaView nombre={me?.nombre ?? "…"} rolLabel={rolLabel} />;
  return <ComercialPersonalView me={me} userId={userId} rolLabel={rolLabel} isLeader={false} />;
}

function LiderCuentaView({ nombre, rolLabel }: { nombre: string; rolLabel: string }) {
  const listarEquipo = useServerFn(obtenerEquipoComercial);
  const { data: equipo, isLoading } = useQuery({
    queryKey: ["equipo-comercial"],
    queryFn: () => listarEquipo({ data: {} as never }),
  });
  const sinAsignar = equipo?.[0]?.sin_asignar ?? 0;

  return (
    <div className="space-y-6">
      <UserCard nombre={nombre} rolLabel={rolLabel} />

      <TeamTable
        titulo="Mi equipo comercial"
        cargando={isLoading}
        filas={equipo ?? []}
        columnas={[
          { label: "Activas", get: (r: MiembroComercial) => r.operaciones_abiertas },
          { label: "Cerradas (mes)", get: (r: MiembroComercial) => r.cerradas_mes },
        ]}
      />

      <SinAsignarAlert count={sinAsignar} />

      <MetasEquipo rol="comercial" puedeCrear />

      <MisDocumentos />

      <p className="text-xs text-muted-foreground">
        ¿Buscas la agenda de contactos?{" "}
        <Link to="/comercial-contactos" className="text-primary hover:underline">
          Ir a Contactos
        </Link>
      </p>
    </div>
  );
}

function ComercialPersonalView({
  me,
  userId,
  rolLabel,
  isLeader,
}: {
  me: { nombre: string; roles: string[] } | undefined;
  userId: string | null;
  rolLabel: string;
  isLeader: boolean;
}) {

  const { data } = useQuery({
    enabled: !!userId,
    queryKey: ["comercial-home", userId, isLeader],
    queryFn: async () => {
      const base = () =>
        supabase.from("cotizaciones").select("*", { count: "exact", head: true });

      const activasQ = isLeader
        ? base().not("estado", "in", `(${CERRADAS.join(",")})`)
        : base().eq("asignado_a", userId!).not("estado", "in", `(${CERRADAS.join(",")})`);

      const mesInicio = new Date();
      mesInicio.setDate(1);
      const mesISO = mesInicio.toISOString().slice(0, 10);

      const cerradasQ = isLeader
        ? base().eq("estado", "cerrada").gte("fecha_despacho", mesISO)
        : base().eq("asignado_a", userId!).eq("estado", "cerrada").gte("fecha_despacho", mesISO);

      const [activas, cerradas, sinAsignar, misRows, sinAsignarRows] = await Promise.all([
        activasQ,
        cerradasQ,
        isLeader
          ? base().is("asignado_a", null).in("estado", NUEVAS)
          : Promise.resolve({ count: null }),
        supabase
          .from("cotizaciones")
          .select("id, contacto_nombre, origen, destinos, estado, fecha_despacho, created_at")
          .eq("asignado_a", userId!)
          .not("estado", "in", `(${CERRADAS.join(",")})`)
          .order("fecha_despacho", { ascending: true })
          .limit(5),
        isLeader
          ? supabase
              .from("cotizaciones")
              .select("id, contacto_nombre, origen, destinos, estado, fecha_despacho, created_at")
              .is("asignado_a", null)
              .in("estado", NUEVAS)
              .order("created_at", { ascending: true })
              .limit(5)
          : Promise.resolve({ data: [] as Row[] }),
      ]);

      return {
        activas: activas.count ?? 0,
        cerradas: cerradas.count ?? 0,
        sinAsignar: sinAsignar.count ?? 0,
        misCotizaciones: (misRows.data ?? []) as Row[],
        solicitudes: ((sinAsignarRows as { data: Row[] | null }).data ?? []) as Row[],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <UserCard nombre={me?.nombre ?? "…"} rolLabel={rolLabel} />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Mis operaciones activas" value={data?.activas ?? null} />
          <StatCard label="Cerradas este mes" value={data?.cerradas ?? null} />
          {isLeader && <StatCard label="Sin asignar" value={data?.sinAsignar ?? null} />}
        </div>
      </div>

      <MetasCard />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Mis cotizaciones activas"
          linkTo="/comercial-cotizaciones"
          empty={(data?.misCotizaciones.length ?? 0) === 0}
        >
          {(data?.misCotizaciones ?? []).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.contacto_nombre ?? "Sin contacto"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.origen ?? "Sin origen"} → {primerDestino(r.destinos)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <EstadoBadge estado={r.estado} />
                <span className="text-xs text-muted-foreground">
                  {formatFecha(r.fecha_despacho)}
                </span>
              </div>
            </li>
          ))}
        </SectionCard>

        {isLeader && (
          <SectionCard
            title="Solicitudes sin asignar"
            linkTo="/comercial-solicitudes"
            empty={(data?.solicitudes.length ?? 0) === 0}
          >
            {(data?.solicitudes ?? []).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.contacto_nombre ?? "Sin contacto"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.origen ?? "Sin origen"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeDays(r.created_at)}
                </span>
              </li>
            ))}
          </SectionCard>
        )}
      </div>

      <MisDocumentos />

      <p className="text-xs text-muted-foreground">
        ¿Buscas la agenda de contactos?{" "}
        <Link to="/comercial-contactos" className="text-primary hover:underline">
          Ir a Contactos
        </Link>
      </p>
    </div>
  );
}
