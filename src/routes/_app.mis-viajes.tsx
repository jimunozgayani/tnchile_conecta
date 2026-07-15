import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Truck, MapPin, Package, Calendar, Ruler, Weight, Camera,
  PlayCircle, PackageCheck, Route as RouteIcon, PackageOpen, CheckCircle2, Lock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";

export const Route = createFileRoute("/_app/mis-viajes")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isChofer = (roles ?? []).some((r: any) => r.role === "chofer");
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isChofer && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: MisViajes,
});

type EstadoViaje = "por_iniciar" | "cargando" | "en_ruta" | "descargando" | "entregado";

const ESTADOS: { key: EstadoViaje; label: string; icon: any; color: string }[] = [
  { key: "por_iniciar", label: "Por iniciar", icon: PlayCircle, color: "bg-zinc-100 text-zinc-800 border-zinc-300" },
  { key: "cargando", label: "Cargando", icon: PackageCheck, color: "bg-amber-100 text-amber-800 border-amber-300" },
  { key: "en_ruta", label: "En ruta", icon: RouteIcon, color: "bg-blue-100 text-blue-800 border-blue-300" },
  { key: "descargando", label: "Descargando", icon: PackageOpen, color: "bg-purple-100 text-purple-800 border-purple-300" },
  { key: "entregado", label: "Entregado", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
];

function MisViajes() {
  const [userId, setUserId] = useState<string | null>(null);
  const [estadoValid, setEstadoValid] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("chofer_perfiles").select("estado_validacion").eq("user_id", user.id).maybeSingle();
      setEstadoValid(data?.estado_validacion ?? null);
    })();
  }, []);

  const isApproved = estadoValid === "aprobado";

  const asignQuery = useQuery({
    enabled: !!userId && isApproved,
    queryKey: ["mis-viajes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asignaciones")
        .select("*, cotizaciones(*), trucks(patente, tipo)")
        .eq("chofer_id", userId!)
        .order("fecha_desde", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!userId) return <div className="text-center text-muted-foreground">Cargando…</div>;

  if (estadoValid !== "aprobado") {
    return (
      <div className="mx-auto max-w-xl">
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-amber-900">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6" />
            <h1 className="text-xl font-bold">Aún no puedes ver viajes</h1>
          </div>
          <p className="mt-2 text-sm">
            Tu inscripción está en estado{" "}
            <span className="font-semibold">
              {estadoValid ? estadoValid.replace("_", " ") : "sin inscripción"}
            </span>
            . Podrás ver tus cargas asignadas cuando un administrador apruebe tu inscripción.
          </p>
          <Link to="/chofer" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            ← Volver a mi portal
          </Link>
        </div>
      </div>
    );
  }

  const asignaciones = asignQuery.data ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">Mis viajes</h1>
        <p className="text-sm text-muted-foreground">
          Cargas asignadas por Operaciones. Puedes actualizar el estado del viaje mientras avanzas.
        </p>
      </div>

      {asignQuery.isLoading && <div className="text-sm text-muted-foreground">Cargando viajes…</div>}
      {!asignQuery.isLoading && asignaciones.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Aún no tienes viajes asignados.
        </div>
      )}

      <div className="space-y-4">
        {asignaciones.map((a: any) => (
          <AsignacionCard key={a.id} asignacion={a} onChanged={() => asignQuery.refetch()} />
        ))}
      </div>
    </div>
  );
}

function AsignacionCard({ asignacion, onChanged }: { asignacion: any; onChanged: () => void }) {
  const cot = asignacion.cotizaciones as any | null;
  const [saving, setSaving] = useState(false);
  const currentEstado = asignacion.estado_viaje as EstadoViaje;
  const currentMeta = ESTADOS.find((e) => e.key === currentEstado) ?? ESTADOS[0];
  const CurrentIcon = currentMeta.icon;

  const destinos: string[] = useMemo(() => {
    const d = cot?.destinos;
    if (Array.isArray(d)) return d.filter((x: any) => typeof x === "string" && x.trim().length > 0);
    return [];
  }, [cot]);

  const fotos: string[] = useMemo(() => {
    const f = cot?.fotos;
    if (Array.isArray(f)) return f.filter((x: any) => typeof x === "string");
    return [];
  }, [cot]);

  const updateEstado = async (nuevo: EstadoViaje) => {
    if (nuevo === currentEstado) return;
    setSaving(true);
    const { error } = await supabase
      .from("asignaciones").update({ estado_viaje: nuevo }).eq("id", asignacion.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Estado actualizado");
    onChanged();
  };

  return (
    <article className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <header className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 ${currentMeta.color}`}>
        <div className="flex items-center gap-2">
          <CurrentIcon className="h-5 w-5" />
          <span className="font-semibold">{currentMeta.label}</span>
        </div>
        <div className="text-xs opacity-80">
          {asignacion.fecha_desde ? `Desde ${asignacion.fecha_desde}` : ""}
          {asignacion.fecha_hasta ? ` · Hasta ${asignacion.fecha_hasta}` : ""}
        </div>
      </header>

      <div className="space-y-4 p-4">
        {cot ? (
          <>
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <InfoRow icon={MapPin} label="Origen" value={cot.origen ?? "—"} />
              <InfoRow icon={Calendar} label="Fecha de despacho" value={cot.fecha_despacho ?? "—"} />
              <InfoRow icon={Truck} label="Tipo de camión" value={cot.tipo_camion ?? "—"} />
              <InfoRow icon={Package} label="Modalidad" value={cot.modalidad ?? "—"} />
              <InfoRow
                icon={Weight}
                label="Peso"
                value={cot.peso_kg ? `${cot.peso_kg} kg` : "—"}
              />
              <InfoRow
                icon={Ruler}
                label="Dimensiones (L×A×A)"
                value={
                  cot.largo_cm || cot.ancho_cm || cot.alto_cm
                    ? `${cot.largo_cm ?? "?"} × ${cot.ancho_cm ?? "?"} × ${cot.alto_cm ?? "?"} cm`
                    : "—"
                }
              />
            </div>

            {destinos.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Destinos
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-sm">
                  {destinos.map((d, i) => <li key={i}>{d}</li>)}
                </ol>
              </div>
            )}

            {fotos.length > 0 && <Fotos paths={fotos} />}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Esta asignación aún no tiene una carga vinculada.
          </p>
        )}

        {asignacion.trucks && (
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            Camión asignado:{" "}
            <span className="font-medium text-foreground">
              {asignacion.trucks.patente} {asignacion.trucks.tipo ? `· ${asignacion.trucks.tipo}` : ""}
            </span>
          </div>
        )}

        {asignacion.notas && (
          <div className="rounded-md border border-dashed p-3 text-sm">
            <span className="font-semibold">Notas: </span>{asignacion.notas}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Actualizar estado del viaje
          </p>
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map(({ key, label, icon: Icon }) => {
              const active = key === currentEstado;
              return (
                <button
                  key={key}
                  disabled={saving || active}
                  onClick={() => updateEstado(key)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:border-primary hover:text-primary"
                  } disabled:opacity-60`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Fotos({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await Promise.all(paths.map((p) => getSignedUrl("cotizacion-fotos", p)));
      if (!cancelled) setUrls(resolved);
    })();
    return () => { cancelled = true; };
  }, [paths]);

  return (
    <div>
      <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Camera className="h-3.5 w-3.5" /> Fotos de la carga
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {urls.map((u, i) =>
          u ? (
            <a key={i} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border">
              <img src={u} alt={`Foto ${i + 1}`} className="h-24 w-full object-cover" />
            </a>
          ) : (
            <div key={i} className="flex h-24 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">
              Sin acceso
            </div>
          )
        )}
      </div>
    </div>
  );
}
