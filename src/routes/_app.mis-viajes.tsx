import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Truck, MapPin, Package, Calendar, Ruler, Weight, Camera,
  PlayCircle, PackageCheck, Route as RouteIcon, PackageOpen, CheckCircle2, Lock,
  ChevronRight, History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";
import { CameraOrFileInput } from "@/components/CameraOrFileInput";
import { validateUpload } from "@/lib/upload-validation";

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

const ESTADOS: {
  key: EstadoViaje; label: string; icon: any;
  bg: string; text: string; border: string; btn: string;
  nextLabel?: string;
  photoTipo?: "foto_guia" | "foto_carga" | "foto_descarga";
  photoLabel?: string;
}[] = [
  { key: "por_iniciar", label: "Por iniciar", icon: PlayCircle,
    bg: "bg-zinc-100", text: "text-zinc-900", border: "border-zinc-300",
    btn: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
    nextLabel: "Empezar a cargar" },
  { key: "cargando", label: "Cargando", icon: PackageCheck,
    bg: "bg-amber-100", text: "text-amber-900", border: "border-amber-300",
    btn: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
    nextLabel: "Salir a ruta",
    photoTipo: "foto_carga", photoLabel: "Fotos de carga y guía" },
  { key: "en_ruta", label: "En ruta", icon: RouteIcon,
    bg: "bg-blue-100", text: "text-blue-900", border: "border-blue-300",
    btn: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800",
    nextLabel: "Llegué, empezar a descargar" },
  { key: "descargando", label: "Descargando", icon: PackageOpen,
    bg: "bg-purple-100", text: "text-purple-900", border: "border-purple-300",
    btn: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
    nextLabel: "Marcar como entregado",
    photoTipo: "foto_descarga", photoLabel: "Fotos de descarga" },
  { key: "entregado", label: "Entregado", icon: CheckCircle2,
    bg: "bg-emerald-100", text: "text-emerald-900", border: "border-emerald-300",
    btn: "" },
];

function metaFor(e: EstadoViaje) {
  return ESTADOS.find((x) => x.key === e) ?? ESTADOS[0];
}
function nextEstado(e: EstadoViaje): EstadoViaje | null {
  const i = ESTADOS.findIndex((x) => x.key === e);
  if (i < 0 || i >= ESTADOS.length - 1) return null;
  return ESTADOS[i + 1].key;
}

function MisViajes() {
  const [userId, setUserId] = useState<string | null>(null);
  const [estadoValid, setEstadoValid] = useState<string | null>(null);
  const [showHistorial, setShowHistorial] = useState(false);

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
            . Podrás ver tus cargas cuando un administrador apruebe tu inscripción.
          </p>
          <Link to="/chofer" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            ← Volver a mi portal
          </Link>
        </div>
      </div>
    );
  }

  const all = asignQuery.data ?? [];
  const activos = all.filter((a: any) => a.estado_viaje !== "entregado");
  const historial = all.filter((a: any) => a.estado_viaje === "entregado");

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-24">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">Mis viajes</h1>
        <p className="text-sm text-muted-foreground">
          Actualiza el estado con un toque. Súbete fotos en carga y descarga.
        </p>
      </div>

      {asignQuery.isLoading && <div className="text-sm text-muted-foreground">Cargando viajes…</div>}
      {!asignQuery.isLoading && activos.length === 0 && (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tienes viajes activos ahora mismo.
        </div>
      )}

      <div className="space-y-4">
        {activos.map((a: any) => (
          <AsignacionCard key={a.id} asignacion={a} onChanged={() => asignQuery.refetch()} />
        ))}
      </div>

      {historial.length > 0 && (
        <div className="pt-4">
          <button
            onClick={() => setShowHistorial((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border bg-muted/40 px-4 py-3 text-sm font-medium hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial de viajes entregados ({historial.length})
            </span>
            <ChevronRight className={`h-4 w-4 transition ${showHistorial ? "rotate-90" : ""}`} />
          </button>
          {showHistorial && (
            <div className="mt-3 space-y-4">
              {historial.map((a: any) => (
                <AsignacionCard key={a.id} asignacion={a} onChanged={() => asignQuery.refetch()} compact />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AsignacionCard({
  asignacion, onChanged, compact,
}: { asignacion: any; onChanged: () => void; compact?: boolean }) {
  const cot = asignacion.cotizaciones as any | null;
  const [saving, setSaving] = useState(false);
  const [showDetalle, setShowDetalle] = useState(!compact);
  const currentEstado = asignacion.estado_viaje as EstadoViaje;
  const currentMeta = metaFor(currentEstado);
  const CurrentIcon = currentMeta.icon;
  const next = nextEstado(currentEstado);
  const nextMeta = next ? metaFor(next) : null;

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

  const eventosQuery = useQuery({
    queryKey: ["eventos-viaje", asignacion.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_viaje")
        .select("*")
        .eq("asignacion_id", asignacion.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const advance = async () => {
    if (!next) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("asignaciones").update({ estado_viaje: next }).eq("id", asignacion.id);
    if (!error && user) {
      await supabase.from("eventos_viaje").insert({
        asignacion_id: asignacion.id,
        chofer_id: user.id,
        tipo: "cambio_estado",
        estado_viaje: next,
      });
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(next === "entregado" ? "¡Viaje entregado!" : `Ahora: ${metaFor(next).label}`);
    onChanged();
    eventosQuery.refetch();
  };

  const showUploader =
    currentMeta.photoTipo && (currentEstado === "cargando" || currentEstado === "descargando");

  return (
    <article className={`overflow-hidden rounded-xl border-2 ${currentMeta.border} bg-card shadow-sm`}>
      <header className={`flex items-center justify-between gap-2 px-4 py-3 ${currentMeta.bg} ${currentMeta.text}`}>
        <div className="flex items-center gap-2">
          <CurrentIcon className="h-6 w-6" />
          <span className="text-base font-bold">{currentMeta.label}</span>
        </div>
        <div className="text-xs opacity-80">
          {asignacion.fecha_desde ?? ""}
        </div>
      </header>

      <div className="space-y-4 p-4">
        {/* Resumen corto siempre visible */}
        {cot && (
          <div className="space-y-1 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">{cot.origen ?? "—"}</p>
                {destinos.length > 0 && (
                  <p className="text-muted-foreground">→ {destinos.join(" → ")}</p>
                )}
              </div>
            </div>
            {cot.fecha_despacho && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Despacho: {cot.fecha_despacho}
              </p>
            )}
          </div>
        )}

        {/* Botón grande de avance */}
        {next && nextMeta && (
          <button
            onClick={advance}
            disabled={saving}
            className={`flex min-h-[64px] w-full items-center justify-center gap-3 rounded-xl px-4 py-4 text-lg font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60 ${currentMeta.btn}`}
          >
            <nextMeta.icon className="h-6 w-6" />
            {currentMeta.nextLabel ?? `Pasar a ${nextMeta.label}`}
          </button>
        )}
        {!next && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 py-4 text-emerald-800">
            <CheckCircle2 className="h-6 w-6" />
            <span className="font-semibold">Viaje completado</span>
          </div>
        )}

        {/* Uploader durante cargando / descargando */}
        {showUploader && (
          <FotoUploader
            asignacionId={asignacion.id}
            tipo={currentMeta.photoTipo!}
            label={currentMeta.photoLabel!}
            onUploaded={() => eventosQuery.refetch()}
          />
        )}

        {/* Fotos ya subidas de este viaje */}
        <EventosFotos eventos={eventosQuery.data ?? []} />

        {/* Detalle expandible */}
        <button
          onClick={() => setShowDetalle((v) => !v)}
          className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          <span>Ver detalle de la carga</span>
          <ChevronRight className={`h-4 w-4 transition ${showDetalle ? "rotate-90" : ""}`} />
        </button>

        {showDetalle && cot && (
          <div className="space-y-3 border-t pt-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={Truck} label="Tipo camión" value={cot.tipo_camion ?? "—"} />
              <InfoRow icon={Package} label="Modalidad" value={cot.modalidad ?? "—"} />
              <InfoRow icon={Weight} label="Peso" value={cot.peso_kg ? `${cot.peso_kg} kg` : "—"} />
              <InfoRow
                icon={Ruler}
                label="L×A×A (cm)"
                value={
                  cot.largo_cm || cot.ancho_cm || cot.alto_cm
                    ? `${cot.largo_cm ?? "?"}×${cot.ancho_cm ?? "?"}×${cot.alto_cm ?? "?"}`
                    : "—"
                }
              />
            </div>
            {fotos.length > 0 && <FotosCarga paths={fotos} />}
            {asignacion.trucks && (
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                Camión: <span className="font-medium text-foreground">
                  {asignacion.trucks.patente}{asignacion.trucks.tipo ? ` · ${asignacion.trucks.tipo}` : ""}
                </span>
              </div>
            )}
            {asignacion.notas && (
              <div className="rounded-md border border-dashed p-2 text-xs">
                <span className="font-semibold">Notas: </span>{asignacion.notas}
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function FotoUploader({
  asignacionId, tipo, label, onUploaded,
}: {
  asignacionId: string;
  tipo: "foto_guia" | "foto_carga" | "foto_descarga";
  label: string;
  onUploaded: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handle = async (file: File) => {
    const v = validateUpload(file);
    if (!v.ok) { toast.error(v.error); return; }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${asignacionId}/${tipo}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("viaje-eventos").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("eventos_viaje").insert({
        asignacion_id: asignacionId,
        chofer_id: user.id,
        tipo,
        storage_path: path,
      });
      if (insErr) throw insErr;
      toast.success("Foto subida");
      onUploaded();
    } catch (e: any) {
      toast.error(e.message ?? "Error al subir foto");
    } finally {
      setUploading(false);
    }
  };

  const tipoBadge =
    tipo === "foto_carga" ? "Foto de carga / guía" :
    tipo === "foto_descarga" ? "Foto de descarga" : "Foto de guía";

  return (
    <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-dark">
        <Camera className="h-4 w-4" /> {label}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        {uploading ? "Subiendo…" : `Toma o sube fotos (${tipoBadge}). Puedes subir varias.`}
      </p>
      <CameraOrFileInput onFile={handle} disabled={uploading} accept="image/*,application/pdf" />
    </div>
  );
}

function EventosFotos({ eventos }: { eventos: any[] }) {
  const fotos = eventos.filter((e) => e.storage_path);
  if (fotos.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Fotos del viaje ({fotos.length})
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotos.map((e) => (
          <EventoFoto key={e.id} path={e.storage_path} tipo={e.tipo} />
        ))}
      </div>
    </div>
  );
}

function EventoFoto({ path, tipo }: { path: string; tipo: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await getSignedUrl("viaje-eventos", path);
      if (!cancelled) setUrl(u);
    })();
    return () => { cancelled = true; };
  }, [path]);
  const tag = tipo === "foto_guia" ? "Guía" : tipo === "foto_carga" ? "Carga" : tipo === "foto_descarga" ? "Descarga" : "";
  const isPdf = path.toLowerCase().endsWith(".pdf");
  return (
    <a href={url ?? "#"} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-md border">
      {isPdf ? (
        <div className="flex h-24 flex-col items-center justify-center bg-muted text-xs text-muted-foreground">
          <Package className="h-6 w-6" />
          <span>PDF</span>
        </div>
      ) : url ? (
        <img src={url} alt={tag} className="h-24 w-full object-cover" />
      ) : (
        <div className="h-24 bg-muted" />
      )}
      <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-center text-[10px] font-medium text-white">
        {tag}
      </span>
    </a>
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

function FotosCarga({ paths }: { paths: string[] }) {
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
        <Camera className="h-3.5 w-3.5" /> Fotos originales de la carga
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {urls.map((u, i) =>
          u ? (
            <a key={i} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border">
              <img src={u} alt={`Foto ${i + 1}`} className="h-20 w-full object-cover" />
            </a>
          ) : (
            <div key={i} className="flex h-20 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">—</div>
          )
        )}
      </div>
    </div>
  );
}
