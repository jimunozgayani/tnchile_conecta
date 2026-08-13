import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { pageHead } from "@/lib/page-head";
import { requireCommercial } from "@/lib/require-admin";
import { obtenerEquipoComercial, type MiembroComercial } from "@/lib/liderazgo.functions";
import { SinAsignarAlert, TeamTable } from "@/components/leader-dashboard";
import { RechazadasSection } from "@/components/RechazadasTable";
import { useStaffIdentity } from "@/hooks/useStaffIdentity";
import { MisDocumentos } from "@/components/staff-home";
import {
  CargaDeTrabajoHoy,
  MetasPersonales,
  ProfileHeader,
  ResumenHistorico,
} from "@/components/perfil-comercial";

export const Route = createFileRoute("/_app/comercial")({
  head: () =>
    pageHead(
      "/comercial",
      "Mi Perfil · TN Chile Conecta",
      "Perfil personal del equipo comercial de TN Chile Conecta: carga de trabajo, metas del período, documentos y resumen histórico.",
    ),
  // La sesión de Supabase vive en localStorage: el gate corre solo en el cliente.
  ssr: false,
  beforeLoad: requireCommercial,
  component: MiPerfilComercialPage,
});

function MiPerfilComercialPage() {
  const { data: me } = useStaffIdentity();
  const roles = me?.roles ?? [];
  const userId = me?.userId ?? null;
  const isLider = roles.includes("lider_cuenta");
  const isAdmin = roles.includes("admin");
  const isLeader = isAdmin || isLider;

  const rolLabel = !me
    ? "…"
    : isLider
      ? "Líder de Cuenta"
      : isAdmin
        ? "Administrador"
        : "Ejecutivo Comercial";

  const listarEquipo = useServerFn(obtenerEquipoComercial);
  const { data: equipo, isLoading: cargandoEquipo } = useQuery({
    enabled: isLeader,
    queryKey: ["equipo-comercial"],
    queryFn: () => listarEquipo({ data: {} as never }),
  });
  const sinAsignar = equipo?.[0]?.sin_asignar ?? 0;

  return (
    <div className="space-y-6">
      {/* 1. Cabecera de perfil */}
      <ProfileHeader userId={userId} nombreFallback={me?.nombre ?? "…"} rolLabel={rolLabel} />

      {isLeader && <SinAsignarAlert count={sinAsignar} />}

      {/* 2. Mi carga de trabajo hoy */}
      <CargaDeTrabajoHoy userId={userId} />

      {/* 3. Metas */}
      <MetasPersonales
        userId={userId}
        puedeCrear={isLeader}
        puedeSelfAsignar={isAdmin}
        mostrarEquipo={isLeader}
        equipo={equipo ?? []}
      />

      {/* 4. Mis documentos */}
      <MisDocumentos />

      {/* 5. Resumen histórico */}
      <ResumenHistorico userId={userId} />

      {/* 6. Mi equipo comercial (solo liderazgo) */}
      {isLeader && (
        <>
          <TeamTable
            titulo="Mi equipo comercial"
            cargando={cargandoEquipo}
            filas={equipo ?? []}
            columnas={[
              { label: "Activas", get: (r: MiembroComercial) => r.operaciones_abiertas },
              { label: "Cerradas (mes)", get: (r: MiembroComercial) => r.cerradas_mes },
            ]}
          />
          <RechazadasSection />
        </>
      )}

      <p className="text-xs text-muted-foreground">
        ¿Buscas la agenda de contactos?{" "}
        <Link to="/comercial-contactos" className="text-primary hover:underline">
          Ir a Contactos
        </Link>
      </p>
    </div>
  );
}
