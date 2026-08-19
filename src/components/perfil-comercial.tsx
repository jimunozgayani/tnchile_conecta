import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Check, Loader2, Pencil, Plus, Target, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";
import { crearMeta, obtenerMetas, type Meta, type MiembroComercial } from "@/lib/liderazgo.functions";
import { ProgressBar, periodoActual } from "@/components/leader-dashboard";
import { ESTADO_LABELS } from "@/components/staff-home";
import { cn } from "@/lib/utils";

const AVATAR_BUCKET = "avatares-perfil";

/* ------------------------------------------------------------------ */
/* 1. Cabecera de perfil                                              */
/* ------------------------------------------------------------------ */

export function useMiPerfil(userId: string | null) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["mi-perfil", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nombre_contacto, cargo, correo, telefono, avatar_url")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const path = (data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
      const avatarUrl = path ? await getSignedUrl(AVATAR_BUCKET, path) : null;
      return { ...(data ?? { id: userId }), avatarUrl } as {
        id: string;
        nombre_contacto: string | null;
        cargo: string | null;
        correo: string | null;
        telefono: string | null;
        avatar_url: string | null;
        avatarUrl: string | null;
      };
    },
  });
}

export function ProfileHeader({
  userId,
  nombreFallback,
  rolLabel,
}: {
  userId: string | null;
  nombreFallback: string;
  rolLabel: string;
}) {
  const qc = useQueryClient();
  const { data: perfil } = useMiPerfil(userId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");

  const nombreVisible = perfil?.nombre_contacto?.trim() || nombreFallback;

  useEffect(() => {
    setNombre(perfil?.nombre_contacto ?? "");
  }, [perfil?.nombre_contacto]);

  const initials = nombreVisible
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  async function subirAvatar(file: File) {
    if (!userId) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecciona una imagen (JPG o PNG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5 MB.");
      return;
    }
    setSubiendo(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);

      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, avatar_url: path } as never, { onConflict: "id" });
      if (error) throw new Error(error.message);

      toast.success("Foto de perfil actualizada.");
      await qc.invalidateQueries({ queryKey: ["mi-perfil", userId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  }

  async function guardarNombre() {
    if (!userId) return;
    const limpio = nombre.trim();
    if (limpio.length < 3) {
      toast.error("Escribe tu nombre completo.");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, nombre_contacto: limpio } as never, { onConflict: "id" });
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditando(false);
    toast.success("Nombre actualizado.");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["mi-perfil", userId] }),
      qc.invalidateQueries({ queryKey: ["staff-identity"] }),
    ]);
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Cambiar foto de perfil"
            className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary text-lg font-bold text-primary-foreground"
          >
            {perfil?.avatarUrl ? (
              <img
                src={perfil.avatarUrl}
                alt={`Foto de perfil de ${nombreVisible}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                {initials || "TN"}
              </span>
            )}
            <span className="absolute inset-0 hidden items-center justify-center bg-black/45 group-hover:flex">
              {subiendo ? (
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void subirAvatar(f);
              e.target.value = "";
            }}
          />

          <div className="min-w-0">
            {editando ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-56 rounded-md border bg-background px-2 py-1 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button type="button" onClick={() => void guardarNombre()} aria-label="Guardar nombre">
                  <Check className="h-4 w-4 text-primary" />
                </button>
                <button type="button" onClick={() => setEditando(false)} aria-label="Cancelar">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold text-primary-dark">{nombreVisible}</h1>
                <button type="button" onClick={() => setEditando(true)} aria-label="Editar nombre">
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                </button>
              </div>
            )}
            <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-dark">
              {rolLabel}
            </span>
            {perfil?.correo && (
              <p className="mt-1 truncate text-xs text-muted-foreground">{perfil.correo}</p>
            )}
          </div>
        </div>

        <Link
          to="/comercial-cotizaciones"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark"
        >
          Ver mi cartera →
        </Link>
      </div>
      <p className="mt-4 text-sm italic text-muted-foreground">La logística la hacemos juntos.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Mi carga de trabajo hoy                                         */
/* ------------------------------------------------------------------ */

const ZONAS: { estados: string[]; label: string; clase: string }[] = [
  {
    estados: ["nueva", "pendiente", "en_exploracion", "costo_fijado", "exploracion_vencida"],
    label: "Nuevas",
    clase: "border-primary/30 bg-primary-soft text-primary-dark",
  },
  {
    estados: ["cotizada", "en_revision"],
    label: "Cotizadas",
    clase:
      "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  },
  {
    estados: ["aceptada", "lista_para_operar", "confirmada", "en_operacion"],
    label: "En curso",
    clase:
      "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
  },
  {
    estados: ["cobro_pendiente", "finalizada", "cerrada"],
    label: "Cierre",
    clase: "border-border bg-muted text-foreground",
  },
];

export function CargaDeTrabajoHoy({ userId }: { userId: string | null }) {
  const { data, isLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["mi-carga-hoy", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("estado")
        .is("deleted_at", null)
        .eq("asignado_a", userId!);
      if (error) throw new Error(error.message);
      const conteo: Record<string, number> = {};
      for (const r of (data ?? []) as { estado: string }[]) {
        conteo[r.estado] = (conteo[r.estado] ?? 0) + 1;
      }
      return conteo;
    },
  });

  const conteo = data ?? {};
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Mi carga de trabajo hoy</h2>
        <span className="text-xs text-muted-foreground">{total} cargas asignadas</span>
      </header>
      {isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Cargando…</p>
      ) : total === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          No tienes cargas asignadas por ahora.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto px-5 py-4">
          {ZONAS.map((z) => {
            const items = z.estados.filter((e) => (conteo[e] ?? 0) > 0);
            const suma = z.estados.reduce((a, e) => a + (conteo[e] ?? 0), 0);
            return (
              <Link
                key={z.label}
                to="/comercial-cotizaciones"
                className={cn(
                  "min-w-[150px] shrink-0 rounded-lg border p-3 transition hover:shadow-sm",
                  z.clase,
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide">{z.label}</p>
                <p className="mt-1 text-2xl font-bold">{suma}</p>
                <p className="mt-1 text-[11px] leading-snug opacity-80">
                  {items.length === 0
                    ? "Sin cargas"
                    : items.map((e) => `${ESTADO_LABELS[e] ?? e} ${conteo[e]}`).join(" · ")}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Metas                                                           */
/* ------------------------------------------------------------------ */

export function MetasPersonales({
  userId,
  puedeCrear,
  puedeSelfAsignar,
  mostrarEquipo,
  equipo,
}: {
  userId: string | null;
  puedeCrear: boolean;
  puedeSelfAsignar: boolean;
  mostrarEquipo: boolean;
  equipo: MiembroComercial[];
}) {
  const periodo = useMemo(periodoActual, []);
  const qc = useQueryClient();
  const listar = useServerFn(obtenerMetas);
  const crear = useServerFn(crearMeta);

  const [open, setOpen] = useState(false);
  const [destino, setDestino] = useState<string>(puedeSelfAsignar ? "mi" : "equipo");
  const [descripcion, setDescripcion] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [unidad, setUnidad] = useState<"operaciones" | "CLP" | "%">("operaciones");
  const [saving, setSaving] = useState(false);

  const { data: metas, isLoading } = useQuery({
    queryKey: ["metas", "comercial", periodo],
    queryFn: () => listar({ data: { rol: "comercial", periodo } }),
  });

  const individuales = (metas ?? []).filter((m: Meta) => m.user_id === userId);
  const deEquipo = (metas ?? []).filter((m: Meta) => !m.user_id);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await crear({
        data: {
          rol: "comercial",
          periodo,
          descripcion,
          valor_objetivo: Number(objetivo),
          unidad,
          user_id: destino === "equipo" ? null : destino === "mi" ? userId : destino,
        },
      });
      toast.success("Meta creada.");
      setDescripcion("");
      setObjetivo("");
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["metas", "comercial", periodo] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la meta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> Metas · {periodo}
        </h2>
        {puedeCrear && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-dark"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar meta
          </button>
        )}
      </header>

      <div className="space-y-5 px-5 py-4">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mis metas
          </p>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando metas…</p>}
          {!isLoading && individuales.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aún no tienes metas individuales para este período.
            </p>
          )}
          {individuales.map((m) => (
            <ProgressBar key={m.id} meta={m} />
          ))}
        </div>

        {mostrarEquipo && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Metas del equipo
            </p>
            {deEquipo.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin metas de equipo definidas.</p>
            )}
            {deEquipo.map((m) => (
              <ProgressBar key={m.id} meta={m} />
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={guardar}
            className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Nueva meta</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                ¿Para quién es la meta?
              </label>
              <select
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {puedeSelfAsignar && <option value="mi">Para mí</option>}
                {equipo.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    Para {m.nombre}
                  </option>
                ))}
                <option value="equipo">Para todo el equipo</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Descripción
              </label>
              <input
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Cerrar 20 cargas en el mes"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Objetivo
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  step="any"
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Unidad
                </label>
                <select
                  value={unidad}
                  onChange={(e) => setUnidad(e.target.value as typeof unidad)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="operaciones">operaciones</option>
                  <option value="CLP">CLP</option>
                  <option value="%">%</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Resumen histórico                                               */
/* ------------------------------------------------------------------ */

type Periodo = "mes" | "trimestre" | "anio" | "todo";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "mes", label: "Mes" },
  { key: "trimestre", label: "Trimestre" },
  { key: "anio", label: "Año" },
  { key: "todo", label: "Todo" },
];

function desdeISO(p: Periodo): string | null {
  const d = new Date();
  if (p === "mes") return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  if (p === "trimestre") return new Date(d.getFullYear(), d.getMonth() - 2, 1).toISOString();
  if (p === "anio") return new Date(d.getFullYear(), 0, 1).toISOString();
  return null;
}

const CERRADAS_OK = ["cerrada", "cobro_pendiente", "finalizada"];

export function ResumenHistorico({ userId }: { userId: string | null }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  const { data, isLoading } = useQuery({
    enabled: !!userId,
    queryKey: ["resumen-historico", userId, periodo],
    queryFn: async () => {
      const desde = desdeISO(periodo);
      let gestionadas = supabase
        .from("cotizaciones")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("asignado_a", userId!);
      if (desde) gestionadas = gestionadas.gte("created_at", desde);

      let cerradas = supabase
        .from("cotizaciones")
        .select("id", { count: "exact", head: true })
        .eq("asignado_a", userId!)
        .in("estado", CERRADAS_OK);
      if (desde) cerradas = cerradas.gte("updated_at", desde);

      const [g, c] = await Promise.all([gestionadas, cerradas]);
      const total = g.count ?? 0;
      const cerr = c.count ?? 0;
      return {
        gestionadas: total,
        cerradas: cerr,
        conversion: total > 0 ? Math.round((cerr / total) * 100) : 0,
      };
    },
  });

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <h2 className="text-sm font-semibold">Resumen histórico</h2>
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodo(p.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                periodo === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
        <Metric label="Cargas gestionadas" value={isLoading ? null : (data?.gestionadas ?? 0)} />
        <Metric label="Cerradas" value={isLoading ? null : (data?.cerradas ?? 0)} />
        <Metric
          label="Tasa de conversión"
          value={isLoading ? null : (data?.conversion ?? 0)}
          sufijo="%"
        />
      </div>
      <p className="px-5 pb-4 text-[11px] text-muted-foreground">
        “Cerradas” se estima con la última actualización de la carga dentro del período.
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  sufijo,
}: {
  label: string;
  value: number | null;
  sufijo?: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary-dark">
        {value === null ? "–" : `${value.toLocaleString("es-CL")}${sufijo ?? ""}`}
      </p>
    </div>
  );
}
