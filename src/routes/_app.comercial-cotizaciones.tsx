import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { sellarCierreYCrearOperacion } from "@/lib/operaciones.functions";
import { pageHead } from "@/lib/page-head";
import { supabase } from "@/integrations/supabase/client";
import {
  createCotizacion,
  actualizarEstadoCotizacion,
  asignarCotizacion,
  obtenerAsignables,
  type Asignable,
} from "@/lib/cotizaciones.functions";
import { nombresAsignados } from "@/lib/solicitudes.functions";
import { ESTADOS_OPERACIONES } from "@/lib/cotizaciones-transiciones";
import { descargarCotizacionPDF } from "@/lib/cotizacion-pdf";
import { CotizacionDrawer, ReasignarModal } from "@/components/CotizacionDrawer";
import { CountdownBadge } from "@/components/ExploracionCountdown";
import { Gate3Actions } from "@/components/Gate3Actions";

import { createContacto } from "@/lib/contactos.functions";
import { fmtCLP } from "@/lib/regiones-capitales";
import { validateUpload } from "@/lib/upload-validation";
import {
  FileText,
  Plus,
  X,
  Search,
  AlertTriangle,
  MoreHorizontal,
  UserCircle2,
  Download,
  Loader2,
} from "lucide-react";

/** Comercial gestiona; operaciones solo lectura. */
async function guard() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/login" });
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (
    !["admin", "lider_cuenta", "comercial", "operador", "jefe_operaciones"].some((r) =>
      roles.includes(r),
    )
  ) {
    throw redirect({ to: "/dashboard" });
  }
}

export const Route = createFileRoute("/_app/comercial-cotizaciones")({
  head: () =>
    pageHead(
      "/comercial-cotizaciones",
      "Pipeline de Cotizaciones · TN Chile Conecta",
      "Pipeline y seguimiento de cotizaciones por estado para el equipo comercial de TN Chile.",
    ),
  ssr: false,
  beforeLoad: guard,
  component: ComercialCotizacionesPage,
});

type Zona = "comercial" | "operaciones" | "cierre";

type Columna = { label: string; estados: string[]; zona: Zona };

/**
 * El nombre visible de cada columna y el estado que la alimenta se definen
 * según el pipeline comercial acordado (el label no siempre coincide con el
 * valor del estado en la base de datos).
 */
const COLUMNAS: Columna[] = [
  {
    label: "Nueva",
    estados: ["nueva", "pendiente", "en_exploracion", "exploracion_vencida", "costo_fijado"],
    zona: "comercial",
  },
  { label: "Cotizada", estados: ["cotizada", "en_revision"], zona: "comercial" },
  { label: "Aceptada", estados: ["aceptada"], zona: "comercial" },
  { label: "Cierre sellado", estados: ["lista_para_operar"], zona: "comercial" },
  { label: "Lista para operar", estados: ["confirmada"], zona: "operaciones" },
  { label: "Confirmada", estados: ["en_operacion"], zona: "operaciones" },
  { label: "En operación", estados: ["finalizada"], zona: "operaciones" },
  { label: "Cobro pendiente", estados: ["cobro_pendiente"], zona: "cierre" },
  { label: "Cerrada", estados: ["cerrada"], zona: "cierre" },
];

/** Estados de la zona comercial donde se permite reasignar. */
const ZONA_COMERCIAL_ESTADOS = [
  "nueva",
  "pendiente",
  "en_exploracion",
  "exploracion_vencida",
  "costo_fijado",
  "cotizada",
  "en_revision",
  "aceptada",
];

const ZONA_LABEL: Record<Zona, string> = {
  comercial: "Zona comercial",
  operaciones: "Zona operaciones",
  cierre: "Cierre comercial",
};

const ZONA_HEAD: Record<Zona, string> = {
  comercial: "border-t-4 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20",
  operaciones: "border-t-4 border-sky-500 bg-sky-50/60 dark:bg-sky-950/20",
  cierre: "border-t-4 border-amber-500 bg-amber-50/60 dark:bg-amber-950/20",
};

type Cotizacion = {
  id: string;
  estado: string;
  contacto_nombre: string | null;
  origen: string | null;
  destinos: unknown;
  tipo_camion: string | null;
  fecha_despacho: string | null;
  precio_ofrecido_cliente_clp: number | null;
  costo_proveedor_fijado_clp: number | null;
  exploracion_limite_at: string | null;
  created_at: string;
  revision_count: number | null;
  comentarios_revision: string | null;
  asignado_a: string | null;
};

const primerDestino = (destinos: unknown): string => {
  if (Array.isArray(destinos) && destinos.length > 0) {
    const d = destinos[0];
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
      const o = d as Record<string, unknown>;
      const v = o["nombre"] ?? o["destino"] ?? o["ciudad"] ?? o["texto"];
      if (typeof v === "string") return v;
    }
  }
  return "—";
};

const fmtFecha = (s: string | null) => {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

export default function ComercialCotizacionesPage() {
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showRechazadas, setShowRechazadas] = useState(false);
  const [open, setOpen] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["mis-roles-cotizaciones"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [] as string[];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      return (data ?? []).map((r: { role: string }) => r.role);
    },
  });
  const roles = rolesQuery.data ?? [];
  const puedeCrear = ["admin", "lider_cuenta", "comercial"].some((r) => roles.includes(r));
  const puedeAsignar = ["admin", "lider_cuenta"].some((r) => roles.includes(r));

  const queryClient = useQueryClient();
  const listKey = ["cotizaciones-pipeline", q, desde, hasta] as const;

  const listQuery = useQuery({
    queryKey: listKey,
    queryFn: async () => {
      // TODO: filtrar por asignado_a = auth.uid() para el rol `comercial`.
      let query = supabase
        .from("cotizaciones")
        .select(
          "id, estado, contacto_nombre, origen, destinos, tipo_camion, fecha_despacho, precio_ofrecido_cliente_clp, costo_proveedor_fijado_clp, exploracion_limite_at, created_at, revision_count, comentarios_revision, asignado_a",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      const term = q.trim();
      if (term) query = query.ilike("contacto_nombre", `%${term}%`);
      if (desde) query = query.gte("fecha_despacho", desde);
      if (hasta) query = query.lte("fecha_despacho", hasta);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Cotizacion[];
    },
  });

  const rows = listQuery.data ?? [];

  /** Actualiza la tarjeta en su lugar; la columna se recalcula sin recargar todo. */
  const patchRow = (id: string, patch: Partial<Cotizacion>) =>
    queryClient.setQueryData<Cotizacion[]>(listKey, (old) =>
      (old ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );

  const asignadosIds = useMemo(
    () => [...new Set(rows.map((r) => r.asignado_a).filter((v): v is string => !!v))],
    [rows],
  );
  const nombresFn = useServerFn(nombresAsignados);
  const nombresQuery = useQuery({
    queryKey: ["cotizaciones-asignados", asignadosIds],
    queryFn: () => nombresFn({ data: { ids: asignadosIds } }),
    enabled: asignadosIds.length > 0,
  });
  const nombres = nombresQuery.data ?? {};

  const asignablesFn = useServerFn(obtenerAsignables);
  const asignablesQuery = useQuery({
    queryKey: ["cotizaciones-asignables"],
    queryFn: () => asignablesFn(),
    enabled: puedeAsignar,
  });

  const rechazadas = useMemo(() => rows.filter((r) => r.estado === "rechazada"), [rows]);
  const porColumna = useMemo(
    () => COLUMNAS.map((c) => ({ col: c, cards: rows.filter((r) => c.estados.includes(r.estado)) })),
    [rows],
  );

  const hasFilters = !!q.trim() || !!desde || !!hasta;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileText className="h-6 w-6 text-primary" aria-hidden="true" />
            Pipeline de Cotizaciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seguimiento de cotizaciones por estado, desde el ingreso comercial hasta el cierre.
          </p>
        </div>
      </header>

      {/* PART B — barra de control fija */}
      <div className="sticky top-0 z-30 -mx-2 border-b bg-background/95 px-2 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <section
          aria-label="Filtros"
          className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3"
        >
          {puedeCrear && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="order-last inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Nueva cotización
            </button>
          )}

        <div className="w-full max-w-[260px] shrink-0 sm:w-[260px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="q">
            Buscar contacto
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre del contacto…"
              className="w-full rounded-md border bg-background py-2 pl-8 pr-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="desde">
            Despacho desde
          </label>
          <input
            id="desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="hasta">
            Despacho hasta
          </label>
          <input
            id="hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={showRechazadas}
            onChange={(e) => setShowRechazadas(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Mostrar rechazadas
        </label>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDesde("");
              setHasta("");
            }}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> Limpiar
          </button>
        )}
        </section>
      </div>


      {/* PART A — kanban */}
      {listQuery.isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {COLUMNAS.map((c) => (
            <div key={c.label} className="h-64 w-64 shrink-0 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="-mx-2 overflow-x-auto px-2 pb-3">
          <div className="flex min-w-max gap-3">
            {porColumna.map(({ col, cards }) => (
              <section
                key={col.label}
                aria-label={`${col.label} (${ZONA_LABEL[col.zona]})`}
                className="flex w-64 shrink-0 flex-col rounded-lg border bg-muted/30"
              >
                <div className={`rounded-t-lg px-3 py-2 ${ZONA_HEAD[col.zona]}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {ZONA_LABEL[col.zona]}
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{col.label}</h2>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold tabular-nums">
                      {cards.length}
                    </span>
                  </div>
                </div>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto p-2">
                  {cards.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">Sin cotizaciones</p>
                  ) : (
                    cards.map((c) => (
                      <Card key={c.id} c={c} puedeActuar={puedeCrear} puedeAsignar={puedeAsignar} asignables={asignablesQuery.data ?? []} nombres={nombres} onPatch={patchRow} onOpen={setFichaId} />
                    ))
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      {/* Rechazadas */}
      {showRechazadas && (
        <section aria-label="Cotizaciones rechazadas" className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Rechazadas ({rechazadas.length})</h2>
          {rechazadas.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay cotizaciones rechazadas.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rechazadas.map((c) => (
                <Card key={c.id} c={c} puedeActuar={puedeCrear} puedeAsignar={puedeAsignar} asignables={asignablesQuery.data ?? []} nombres={nombres} onPatch={patchRow} onOpen={setFichaId} />
              ))}
            </div>
          )}
        </section>
      )}

      {fichaId && (
        <CotizacionDrawer
          id={fichaId}
          roles={roles}
          asignables={asignablesQuery.data ?? []}
          nombreAsignado={
            nombres[rows.find((r) => r.id === fichaId)?.asignado_a ?? ""] ?? undefined
          }
          onClose={() => setFichaId(null)}
          onChanged={(patch) => patchRow(fichaId, patch as Partial<Cotizacion>)}
        />
      )}

      {open && <NuevaCotizacionModal onClose={() => setOpen(false)} onSaved={() => listQuery.refetch()} />}
    </div>
  );
}

type CardProps = {
  c: Cotizacion;
  puedeActuar: boolean;
  puedeAsignar: boolean;
  asignables: Asignable[];
  nombres: Record<string, string>;
  onPatch: (id: string, patch: Partial<Cotizacion>) => void;
  onOpen: (id: string) => void;
};

const ACCIONES: Record<string, { estado: string; label: string }[]> = {
  nueva: [{ estado: "cotizada", label: "Marcar como cotizada" }],
  pendiente: [{ estado: "cotizada", label: "Marcar como cotizada" }],
  cotizada: [
    { estado: "aceptada", label: "Marcar como aceptada" },
    { estado: "en_revision", label: "Poner en revisión" },
    { estado: "rechazada", label: "Rechazar" },
  ],
  aceptada: [{ estado: "lista_para_operar", label: "Sellar cierre" }],
  cobro_pendiente: [{ estado: "cerrada", label: "Marcar como cerrada" }],
};

function Card({ c, puedeActuar, puedeAsignar, asignables, nombres, onPatch, onOpen }: CardProps) {
  const actualizar = useServerFn(actualizarEstadoCotizacion);
  const asignar = useServerFn(asignarCotizacion);
  const sellar = useServerFn(sellarCierreYCrearOperacion);
  const [menu, setMenu] = useState(false);
  const [chip, setChip] = useState(false);
  const [reasignarOpen, setReasignarOpen] = useState(false);
  const [comentarioPara, setComentarioPara] = useState<"en_revision" | "rechazada" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const revCount = c.revision_count ?? 0;
  const enRevision = c.estado === "en_revision" || (revCount > 0 && c.estado === "cotizada");
  const acciones = puedeActuar ? (ACCIONES[c.estado] ?? []) : [];
  const esDeOperaciones = ESTADOS_OPERACIONES.includes(c.estado);
  const puedePDF = c.estado === "cotizada" || c.estado === "aceptada";

  const generarPDF = async () => {
    setPdfBusy(true);
    try {
      await descargarCotizacionPDF(c.id);
      toast.success("PDF generado correctamente");
      setMenu(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  const aplicar = async (estado: string, comentario?: string) => {
    setBusy(true);
    try {
      const res = await actualizar({ data: { id: c.id, estado, comentario: comentario ?? null } });
      onPatch(c.id, {
        estado: res.estado,
        revision_count: res.revision_count,
        ...(estado === "en_revision"
          ? {
              comentarios_revision: comentario ?? null,
              exploracion_abierta_at: null,
              exploracion_limite_at: null,
              costo_proveedor_fijado_clp: null,
              propuesta_ganadora_id: null,
            }
          : {}),
      });
      if (estado === "lista_para_operar") {
        try {
          const op = await sellar({ data: { cotizacion_id: c.id } });
          toast.success(
            `Cierre sellado. Operación N° ${op.numero_operacion} creada y enviada a Operaciones.`,
          );
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Cierre sellado, pero no se pudo crear la operación.",
          );
        }
      } else {
        toast.success("Estado actualizado");
      }
      setMenu(false);
      setComentarioPara(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    } finally {
      setBusy(false);
    }
  };

  const onAccion = (estado: string) => {
    if (estado === "en_revision" || estado === "rechazada") {
      setComentarioPara(estado);
      setMenu(false);
      return;
    }
    if (estado === "lista_para_operar") {
      if (
        !window.confirm(
          "¿Confirmas el cierre? Se generarán la OC y la Orden de Venta automáticamente al completar este paso.",
        )
      )
        return;
    }
    if (estado === "cerrada") {
      if (!window.confirm("¿Confirmar cierre final de la operación?")) return;
    }
    void aplicar(estado);
  };

  const reasignar = async (uid: string) => {
    setBusy(true);
    try {
      await asignar({ data: { id: c.id, asignado_a: uid } });
      onPatch(c.id, { asignado_a: uid });
      toast.success("Cotización reasignada");
      setChip(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reasignar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className="relative cursor-pointer rounded-md border bg-card p-2.5 text-xs shadow-sm transition hover:border-primary/50 hover:shadow"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button,a,[data-stop]")) return;
        onOpen(c.id);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-bold leading-tight">{c.contacto_nombre ?? "Sin contacto"}</p>
        {(acciones.length > 0 || puedePDF || puedeAsignar) && (
          <div className="relative">
            <button
              type="button"
              aria-label="Acciones"
              onClick={() => setMenu((v) => !v)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menu && (
              <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-md border bg-popover shadow-lg">
                {acciones.map((a) => (
                  <button
                    key={a.estado}
                    type="button"
                    disabled={busy}
                    onClick={() => onAccion(a.estado)}
                    className="block w-full px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-60"
                  >
                    {a.label}
                  </button>
                ))}
                {puedePDF && (
                  <button
                    type="button"
                    disabled={pdfBusy}
                    onClick={() => void generarPDF()}
                    className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-60"
                  >
                    {pdfBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {pdfBusy ? "Generando PDF…" : "Descargar cotización PDF"}
                  </button>
                )}
                {puedeAsignar && ZONA_COMERCIAL_ESTADOS.includes(c.estado) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false);
                      setReasignarOpen(true);
                    }}
                    className="block w-full border-t px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    Reasignar
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {enRevision && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900">
          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> En revisión
          {revCount > 1 ? ` (×${revCount})` : ""}
        </span>
      )}

      {c.estado === "en_exploracion" && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
            🔍 En exploración
          </span>
          <CountdownBadge limiteAt={c.exploracion_limite_at} className="text-[10px]" />
        </div>
      )}

      {c.estado === "exploracion_vencida" && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
          ⏰ Tiempo vencido — esperando revisión
        </span>
      )}

      {c.estado === "costo_fijado" && (
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
          ✅ Costo fijado: {fmtCLP(c.costo_proveedor_fijado_clp)}
        </span>
      )}

      <p className="mt-1.5 text-muted-foreground">
        {c.origen ?? "—"} → {primerDestino(c.destinos)}
      </p>
      <p className="mt-0.5 text-muted-foreground">{c.tipo_camion || "Tipo sin definir"}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{fmtFecha(c.fecha_despacho)}</span>
        <span className="font-semibold text-foreground">{fmtCLP(c.precio_ofrecido_cliente_clp)}</span>
      </div>

      {esDeOperaciones && (
        <p className="mt-1.5 text-[10px] italic text-muted-foreground">En manos de Operaciones</p>
      )}

      {c.estado === "lista_para_operar" && puedeAsignar && (
        <div className="mt-2 border-t pt-2">
          <Gate3Actions
            id={c.id}
            size="xs"
            onDone={(patch: Record<string, unknown>) => onPatch(c.id, patch as Partial<Cotizacion>)}
          />

        </div>
      )}



      {/* Chip de asignación */}
      <div className="relative mt-2 border-t pt-1.5">
        <button
          type="button"
          disabled={!puedeAsignar || busy}
          onClick={() => setChip((v) => !v)}
          className={`inline-flex max-w-full items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px] ${
            c.asignado_a ? "text-foreground" : "text-muted-foreground"
          } ${puedeAsignar ? "hover:bg-muted" : "cursor-default"}`}
        >
          <UserCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {c.asignado_a ? nombres[c.asignado_a] || "Asignada" : "Sin asignar"}
          </span>
        </button>
        {chip && puedeAsignar && (
          <div className="absolute left-0 z-20 mt-1 max-h-48 w-52 overflow-y-auto rounded-md border bg-popover shadow-lg">
            {asignables.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">Sin usuarios asignables</p>
            ) : (
              asignables.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void reasignar(a.id)}
                  className="block w-full truncate px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-60"
                >
                  {a.nombre}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {reasignarOpen && (
        <ReasignarModal
          id={c.id}
          asignables={asignables}
          onClose={() => setReasignarOpen(false)}
          onDone={(uid) => onPatch(c.id, { asignado_a: uid })}
        />
      )}

      {comentarioPara && (
        <ComentarioModal
          modo={comentarioPara}
          revisionCount={revCount}
          busy={busy}
          onCancel={() => setComentarioPara(null)}
          onSubmit={(txt) => void aplicar(comentarioPara, txt)}
        />
      )}
    </article>
  );
}

function ComentarioModal({
  modo,
  revisionCount,
  busy,
  onCancel,
  onSubmit,
}: {
  modo: "en_revision" | "rechazada";
  revisionCount: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (comentario: string) => void;
}) {
  const [txt, setTxt] = useState("");
  const valido = txt.trim().length >= 10;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) onSubmit(txt.trim());
        }}
        className="w-full max-w-md space-y-3 rounded-lg border bg-card p-5 text-sm shadow-xl"
      >
        <h2 className="text-base font-bold">
          {modo === "en_revision" ? "Poner en revisión" : "Rechazar cotización"}
        </h2>
        {revisionCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Esta cotización ha vuelto al ciclo {revisionCount}{" "}
            {revisionCount === 1 ? "vez" : "veces"}
          </p>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="cmt">
            Comentario * (mínimo 10 caracteres)
          </label>
          <textarea
            id="cmt"
            rows={4}
            required
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!valido || busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            Confirmar
          </button>
        </div>
      </form>
    </div>
  );
}

function NuevaCotizacionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const crear = useServerFn(createCotizacion);
  const crearContacto = useServerFn(createContacto);
  const [saving, setSaving] = useState(false);
  const [contactoQ, setContactoQ] = useState("");
  const [contactoId, setContactoId] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [tipoCamion, setTipoCamion] = useState("");
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [peso, setPeso] = useState("");
  const [largo, setLargo] = useState("");
  const [ancho, setAncho] = useState("");
  const [alto, setAlto] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);

  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineBusy, setInlineBusy] = useState(false);
  const [inlineNombre, setInlineNombre] = useState("");
  const [inlineEmpresa, setInlineEmpresa] = useState("");
  const [inlineTelefono, setInlineTelefono] = useState("");
  const [inlineEmail, setInlineEmail] = useState("");

  const contactosQuery = useQuery({
    queryKey: ["contactos-select", contactoQ],
    queryFn: async () => {
      let query = supabase
        .from("contactos")
        .select("id, nombre, empresa, telefono, email")
        .is("deleted_at", null)
        .order("nombre")
        .limit(50);
      const term = contactoQ.trim();
      if (term) query = query.or(`nombre.ilike.%${term}%,empresa.ilike.%${term}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        nombre: string;
        empresa: string | null;
        telefono: string | null;
        email: string | null;
      }[];
    },
  });

  const tiposCamionQuery = useQuery({
    queryKey: ["tipos-camion-activos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tipos_camion")
        .select("id, nombre")
        .eq("activo", true)
        .order("orden");
      if (error) throw error;
      return (data ?? []) as { id: string; nombre: string }[];
    },
  });

  const sinResultados =
    !!contactoQ.trim() && !contactosQuery.isLoading && (contactosQuery.data ?? []).length === 0;

  const crearContactoInline = async () => {
    if (!inlineNombre.trim()) return;
    setInlineBusy(true);
    try {
      const res = await crearContacto({
        data: {
          nombre: inlineNombre.trim(),
          empresa: inlineEmpresa.trim() || null,
          telefono: inlineTelefono.trim() || null,
          email: inlineEmail.trim() || null,
          tipos: ["cliente"],
          temperatura: "frio",
          etapa_comercial: "lead",
        },
      });
      if (!telefono && inlineTelefono.trim()) setTelefono(inlineTelefono.trim());
      if (!email && inlineEmail.trim()) setEmail(inlineEmail.trim());
      setContactoQ(inlineNombre.trim());
      await contactosQuery.refetch();
      setContactoId(res.id);
      setInlineOpen(false);
      toast.success("Contacto creado y seleccionado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el contacto");
    } finally {
      setInlineBusy(false);
    }
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactoId) {
      toast.error("Selecciona un contacto");
      return;
    }
    setSaving(true);
    try {
      const rutas: string[] = [];
      if (fotos.length > 0) {
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData.user?.id;
        if (!uid) throw new Error("Sesión expirada, vuelve a iniciar sesión.");
        for (const f of fotos) {
          const path = `${uid}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_")}`;
          const { error } = await supabase.storage.from("cotizacion-fotos").upload(path, f);
          if (error) throw new Error(error.message);
          rutas.push(path);
        }
      }
      await crear({
        data: {
          contacto_id: contactoId,
          origen,
          destino,
          tipo_camion: tipoCamion || null,
          fecha_despacho: fecha || null,
          notas_admin: notas || null,
          contacto_telefono: telefono || null,
          contacto_email: email || null,
          peso_kg: peso ? Number(peso) : null,
          largo_cm: largo ? Number(largo) : null,
          ancho_cm: ancho ? Number(ancho) : null,
          alto_cm: alto ? Number(alto) : null,
          fotos: rutas,
        },
      });
      toast.success("Cotización creada");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la cotización");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <form
        onSubmit={submit}
        className="my-8 w-full max-w-lg space-y-3 rounded-lg border bg-card p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Nueva cotización</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="c-buscar">
            Contacto *
          </label>
          <input
            id="c-buscar"
            value={contactoQ}
            onChange={(e) => {
              setContactoQ(e.target.value);
              setContactoId("");
            }}
            placeholder="Buscar por nombre o empresa…"
            className="mb-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select
            value={contactoId}
            onChange={(e) => {
              const id = e.target.value;
              setContactoId(id);
              const sel = (contactosQuery.data ?? []).find((x) => x.id === id);
              if (sel) {
                setTelefono(sel.telefono ?? "");
                setEmail(sel.email ?? "");
              }
            }}
            aria-label="Contacto"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecciona un contacto…</option>
            {(contactosQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.empresa ? ` · ${c.empresa}` : ""}
              </option>
            ))}
          </select>

          {!contactoId && contactoQ.trim() && (
            <p className="mt-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-600 dark:text-amber-400">
              Selecciona un contacto de la lista o créalo abajo.
            </p>
          )}

          {sinResultados && !inlineOpen && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs text-muted-foreground">No se encontró ningún contacto.</p>
              <button
                type="button"
                onClick={() => {
                  setInlineNombre(contactoQ.trim());
                  setInlineTelefono(telefono);
                  setInlineEmail(email);
                  setInlineOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-md border border-primary px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Crear contacto nuevo
              </button>
            </div>
          )}

          {inlineOpen && (
            <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-semibold">Nuevo contacto</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={inlineNombre}
                  onChange={(e) => setInlineNombre(e.target.value)}
                  placeholder="Nombre *"
                  aria-label="Nombre del nuevo contacto"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={inlineEmpresa}
                  onChange={(e) => setInlineEmpresa(e.target.value)}
                  placeholder="Empresa"
                  aria-label="Empresa del nuevo contacto"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={inlineTelefono}
                  onChange={(e) => setInlineTelefono(e.target.value)}
                  placeholder="Teléfono"
                  aria-label="Teléfono del nuevo contacto"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <input
                  value={inlineEmail}
                  onChange={(e) => setInlineEmail(e.target.value)}
                  placeholder="Email"
                  aria-label="Email del nuevo contacto"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInlineOpen(false)}
                  className="rounded-md border px-3 py-1.5 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void crearContactoInline()}
                  disabled={inlineBusy || !inlineNombre.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {inlineBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Crear y usar este contacto
                </button>
              </div>
            </div>
          )}
        </div>


        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="c-origen">
              Origen *
            </label>
            <input
              id="c-origen"
              required
              value={origen}
              onChange={(e) => setOrigen(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="c-destino">
              Destino *
            </label>
            <input
              id="c-destino"
              required
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="c-tel">
              Teléfono del contacto
            </label>
            <input
              id="c-tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="c-email">
              Email del contacto
            </label>
            <input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="c-peso">
              Peso estimado (kg)
            </label>
            <input
              id="c-peso"
              type="number"
              min="0"
              step="1"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="c-tipo">
              Tipo de camión
            </label>
            <select
              id="c-tipo"
              value={tipoCamion}
              onChange={(e) => setTipoCamion(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Sin definir</option>
              {(tiposCamionQuery.data ?? []).map((t) => (
                <option key={t.id} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium" htmlFor="c-fecha">
              Fecha de despacho
            </label>
            <input
              id="c-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium">Dimensiones (opcional)</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={largo}
              onChange={(e) => setLargo(e.target.value)}
              placeholder="Largo (cm)"
              aria-label="Largo en centímetros"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={ancho}
              onChange={(e) => setAncho(e.target.value)}
              placeholder="Ancho (cm)"
              aria-label="Ancho en centímetros"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="1"
              value={alto}
              onChange={(e) => setAlto(e.target.value)}
              placeholder="Alto (cm)"
              aria-label="Alto en centímetros"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="c-fotos">
            Fotos (opcional, máx. 5)
          </label>
          <input
            id="c-fotos"
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              const validos: File[] = [];
              for (const f of files) {
                const res = validateUpload(f);
                if (!f.type.startsWith("image/") || !res.ok) {
                  toast.error(`${f.name}: solo imágenes JPG o PNG de hasta 10 MB.`);
                  continue;
                }
                validos.push(f);
              }
              if (validos.length > 5) {
                toast.error("Máximo 5 fotos.");
              }
              setFotos(validos.slice(0, 5));
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          {fotos.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {fotos.length} foto{fotos.length === 1 ? "" : "s"} seleccionada
              {fotos.length === 1 ? "" : "s"}.
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor="c-notas">
            Notas internas
          </label>
          <textarea
            id="c-notas"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !contactoId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Crear cotización"}
          </button>
        </div>
      </form>
    </div>
  );
}
