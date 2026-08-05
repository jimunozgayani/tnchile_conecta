import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, FileText, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/** Etiquetas y color por estado de cotización (paleta corporativa TN Chile). */
export const ESTADO_LABELS: Record<string, string> = {
  nueva: "Nueva",
  pendiente: "Nueva",
  cotizada: "Cotizada",
  aceptada: "Aceptada",
  en_revision: "En revisión",
  rechazada: "Rechazada",
  lista_para_operar: "Cierre sellado",
  confirmada: "Lista para operar",
  en_operacion: "Confirmada",
  finalizada: "En operación",
  cobro_pendiente: "Cobro pendiente",
  cerrada: "Cerrada",
};

const ESTADO_CLASSES: Record<string, string> = {
  nueva: "bg-primary-soft text-primary-dark",
  pendiente: "bg-primary-soft text-primary-dark",
  cotizada: "bg-primary-soft text-primary-dark",
  aceptada: "bg-primary text-primary-foreground",
  en_revision: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  rechazada: "bg-destructive/10 text-destructive",
  lista_para_operar: "bg-primary text-primary-foreground",
  confirmada: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  en_operacion: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  finalizada: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  cobro_pendiente: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  cerrada: "bg-muted text-muted-foreground",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
        ESTADO_CLASSES[estado] ?? "bg-muted text-muted-foreground",
      )}
    >
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

export function formatFecha(value: string | null): string {
  if (!value) return "Sin fecha";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function relativeDays(value: string | null): string {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "hace minutos";
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

export function primerDestino(destinos: unknown): string {
  if (!Array.isArray(destinos) || destinos.length === 0) return "Sin destino";
  const first = destinos[0] as unknown;
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    const o = first as Record<string, unknown>;
    const v = o["destino"] ?? o["nombre"] ?? o["ciudad"] ?? o["direccion"];
    if (typeof v === "string") return v;
  }
  return "Sin destino";
}

export function UserCard({
  nombre,
  rolLabel,
}: {
  nombre: string;
  rolLabel: string;
}) {
  const initials = nombre
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
          {initials || "TN"}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-primary-dark">{nombre}</h1>
          <span className="mt-1 inline-flex rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-dark">
            {rolLabel}
          </span>
        </div>
      </div>
      <p className="mt-4 text-sm italic text-muted-foreground">
        La logística la hacemos juntos.
      </p>
    </section>
  );
}

export function StatCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-primary-dark">{value ?? "–"}</p>
    </div>
  );
}

export function MetasCard() {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Metas del período</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Configurable por el Líder de Cuenta / Jefe de Operaciones — próximamente.
      </p>
    </section>
  );
}

const DOCS_BUCKET = "documentos-privados";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MisDocumentos() {
  const [open, setOpen] = useState(false);

  const { data: files, isLoading } = useQuery({
    enabled: open,
    queryKey: ["documentos-privados"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.storage.from(DOCS_BUCKET).list(user.id, {
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error) throw new Error(error.message);
      return (data ?? [])
        .filter((f) => f.id !== null)
        .map((f) => ({
          name: f.name,
          path: `${user.id}/${f.name}`,
          size: (f.metadata as { size?: number } | null)?.size ?? null,
        }));
    },
  });

  async function descargar(path: string) {
    const url = await getSignedUrl(DOCS_BUCKET, path);
    if (!url) {
      toast.error("No se pudo generar el enlace de descarga.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 p-5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-primary" />
          Mis documentos
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="px-5 pb-5">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando documentos…</p>}
          {!isLoading && (files ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Administración aún no ha compartido documentos privados contigo.
            </p>
          )}
          <ul className="divide-y">
            {(files ?? []).map((f) => (
              <li key={f.path} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => descargar(f.path)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function SectionCard({
  title,
  linkTo,
  linkLabel = "Ver todas",
  empty,
  children,
}: {
  title: string;
  linkTo: string;
  linkLabel?: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link to={linkTo} className="text-xs font-medium text-primary hover:underline">
          {linkLabel} →
        </Link>
      </header>
      {empty ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Nada por aquí por ahora.</p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}
