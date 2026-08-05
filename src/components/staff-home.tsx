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

export function MisDocumentos() {
  const [open, setOpen] = useState(false);
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
        <p className="px-5 pb-5 text-sm text-muted-foreground">
          Los documentos privados compartidos por Administración aparecerán aquí.
        </p>
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
