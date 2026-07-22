import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useMemo, useState, useCallback } from "react";
import { History as HistoryIcon, RefreshCw, ArrowRightLeft, Plus, XCircle, MousePointerClick, Link as LinkIcon, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_app/mi-auditoria")({
  head: () =>
    pageHead(
      "/mi-auditoria",
      "Mi auditoría de acceso · Portal TN Chile",
      "Registro personal de ajustes automáticos a tu espacio activo por cambios de roles, para depurar problemas de acceso.",
    ),
  component: MiAuditoriaPage,
});

type EntryKind = "switched" | "lost-all" | "gained" | "user" | "deep-link";
type EntrySource = "user" | "deep-link" | "role-change" | "mount" | null;
type Entry = {
  id: string;
  kind: EntryKind;
  from_space: string | null;
  to_space: string | null;
  added_roles: string[];
  removed_roles: string[];
  context: { path?: string | null; pathname?: string | null; hash?: string | null; rejected?: boolean; reason?: string } | null;
  source: EntrySource;
  created_at: string;
};

type KindFilter = "all" | EntryKind | "rejected";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todos los tipos" },
  { value: "user", label: "Cambio manual" },
  { value: "switched", label: "Cambio automático" },
  { value: "gained", label: "Rol agregado" },
  { value: "lost-all", label: "Sin acceso" },
  { value: "deep-link", label: "Deep link" },
  { value: "rejected", label: "Rechazados" },
];

const PAGE_SIZE = 25;

const spaceLabel = (s: string | null) =>
  s === "chofer" ? "Espacio Choferes" : s === "proveedor" ? "Portal Proveedor" : "—";

function KindBadge({ kind, rejected }: { kind: EntryKind; rejected?: boolean }) {
  if (rejected)
    return (
      <Badge className="bg-red-100 text-red-900 hover:bg-red-100">
        <ShieldAlert className="h-3 w-3 mr-1" /> Rechazado
      </Badge>
    );
  if (kind === "switched")
    return (
      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
        <ArrowRightLeft className="h-3 w-3 mr-1" /> Cambio automático
      </Badge>
    );
  if (kind === "gained")
    return (
      <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
        <Plus className="h-3 w-3 mr-1" /> Rol agregado
      </Badge>
    );
  if (kind === "user")
    return (
      <Badge className="bg-sky-100 text-sky-900 hover:bg-sky-100">
        <MousePointerClick className="h-3 w-3 mr-1" /> Cambio manual
      </Badge>
    );
  if (kind === "deep-link")
    return (
      <Badge className="bg-slate-100 text-slate-900 hover:bg-slate-100">
        <LinkIcon className="h-3 w-3 mr-1" /> Deep link
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-900 hover:bg-red-100">
      <XCircle className="h-3 w-3 mr-1" /> Sin acceso
    </Badge>
  );
}

function MiAuditoriaPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState<KindFilter>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any)
      .from("space_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (kind === "rejected") {
      q = q.eq("context->>rejected", "true");
    } else if (kind !== "all") {
      q = q.eq("kind", kind);
    }
    if (from) q = q.gte("created_at", new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }

    const fromIdx = page * PAGE_SIZE;
    const toIdx = fromIdx + PAGE_SIZE - 1;
    const { data, count } = await q.range(fromIdx, toIdx);
    setItems((data ?? []) as Entry[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [kind, from, to, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [kind, from, to]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const hasFilters = kind !== "all" || !!from || !!to;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-[#2D7A45]" aria-hidden="true" />
          <h1 className="text-xl md:text-2xl font-semibold">Mi auditoría de acceso</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          aria-label="Actualizar registro"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
      </header>

      <p className="text-sm text-muted-foreground">
        Este registro es privado: solo tú puedes verlo. Muestra cuándo el sistema
        ajustó automáticamente tu espacio activo por cambios en tus roles.
      </p>

      <div className="border rounded-lg p-3 bg-card grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label htmlFor="filter-kind" className="text-xs">Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as KindFilter)}>
            <SelectTrigger id="filter-kind" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="filter-from" className="text-xs">Desde</Label>
          <Input id="filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label htmlFor="filter-to" className="text-xs">Hasta</Label>
          <Input id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" />
        </div>
        {hasFilters && (
          <div className="sm:col-span-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setKind("all"); setFrom(""); setTo(""); }}
            >
              Limpiar filtros
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          {hasFilters
            ? "Sin eventos que coincidan con los filtros aplicados."
            : "Sin eventos registrados. Aparecerán aquí cuando cambien tus roles."}
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((e) => (
              <li key={e.id} className="border rounded-lg p-3 bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <KindBadge kind={e.kind} rejected={e.context?.rejected} />
                  <time className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("es-CL")}
                  </time>
                </div>
                <div className="mt-2 text-sm">
                  {e.context?.rejected && (
                    <p className="text-red-800">
                      Se rechazó tu intento de cambiar a <strong>{spaceLabel(e.to_space)}</strong>
                      {e.context?.reason ? <> ({e.context.reason})</> : null}.
                    </p>
                  )}
                  {!e.context?.rejected && e.kind === "user" && (
                    <p>
                      Cambiaste manualmente de <strong>{spaceLabel(e.from_space)}</strong> a{" "}
                      <strong>{spaceLabel(e.to_space)}</strong>.
                    </p>
                  )}
                  {e.kind === "deep-link" && (
                    <p>
                      Un enlace directo te llevó de <strong>{spaceLabel(e.from_space)}</strong> a{" "}
                      <strong>{spaceLabel(e.to_space)}</strong>.
                    </p>
                  )}
                  {e.kind === "switched" && (
                    <p>
                      Cambiado de <strong>{spaceLabel(e.from_space)}</strong> a{" "}
                      <strong>{spaceLabel(e.to_space)}</strong>.
                    </p>
                  )}
                  {e.kind === "gained" && (
                    <p>
                      Se agregaron nuevos roles mientras estabas en{" "}
                      <strong>{spaceLabel(e.from_space)}</strong>.
                    </p>
                  )}
                  {e.kind === "lost-all" && (
                    <p>
                      Perdiste acceso a los espacios de Proveedor y Chofer estando en{" "}
                      <strong>{spaceLabel(e.from_space)}</strong>.
                    </p>
                  )}
                  {(e.added_roles?.length ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-emerald-800">
                      + {e.added_roles.join(", ")}
                    </p>
                  )}
                  {(e.removed_roles?.length ?? 0) > 0 && (
                    <p className="mt-1 text-xs text-red-800">
                      − {e.removed_roles.join(", ")}
                    </p>
                  )}
                  {(e.context?.path || e.context?.pathname) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ruta: <code>{e.context?.pathname ?? e.context?.path}{e.context?.hash ?? ""}</code>
                      {e.source ? <> · Origen: <code>{e.source}</code></> : null}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <nav className="flex items-center justify-between pt-2" aria-label="Paginación de eventos">
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString("es-CL")} evento{total === 1 ? "" : "s"} · Página {page + 1} de {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => (p + 1 < totalPages ? p + 1 : p))}
                disabled={page + 1 >= totalPages}
                aria-label="Página siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
