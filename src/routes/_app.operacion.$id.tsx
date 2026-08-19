import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, FileText, Loader2 } from "lucide-react";
import { pageHead } from "@/lib/page-head";
import { requireStaffInterno } from "@/lib/require-admin";
import { useStaffIdentity } from "@/hooks/useStaffIdentity";
import { getSignedUrl } from "@/lib/signed-url";
import { DescargarDocumentoOperacion } from "@/components/DescargarDocumentoOperacion";
import { DescargarAsignacion } from "@/components/DescargarAsignacion";

import { AsignarChoferPanel } from "@/components/AsignarChoferPanel";
import { EjecucionOperacionPanel } from "@/components/EjecucionOperacionPanel";
import { PagoProveedorPanel } from "@/components/pagos-cierre";

import {
  actualizarEstadoOperacion,
  guardarOperacion,
  obtenerOperacion,
  type Operacion,
} from "@/lib/operaciones.functions";

export const Route = createFileRoute("/_app/operacion/$id")({
  head: () =>
    pageHead(
      "/operacion",
      "Ficha de operación · TN Chile Conecta",
      "Ficha de operación TN Chile: datos de la carga, asignación de chofer y camión, precios y avance de estado hasta el cobro.",
    ),
  // Supabase session lives in localStorage; gate must run client-side only.
  ssr: false,
  beforeLoad: requireStaffInterno,
  component: FichaOperacion,
});

const ESTADO_LABEL: Record<string, string> = {
  lista_para_operar: "Lista para operar",
  confirmada: "Confirmada",
  en_operacion: "En operación",
  finalizada: "Finalizada",
  cobro_pendiente: "Cobro pendiente",
  cerrada: "Cerrada",
};

const SIGUIENTE: Record<string, { estado: string; label: string }> = {
  lista_para_operar: { estado: "confirmada", label: "Confirmar operación" },
  confirmada: { estado: "en_operacion", label: "Iniciar operación" },
  en_operacion: { estado: "finalizada", label: "Marcar como finalizada" },
  finalizada: { estado: "cobro_pendiente", label: "Pasar a cobro pendiente" },
};

const clp = (v: number | null) =>
  v == null ? "—" : `$${Math.round(v).toLocaleString("es-CL")}`;

function EstadoBadge({ estado }: { estado: string }) {
  const verde = estado === "cobro_pendiente" || estado === "cerrada";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
        verde ? "bg-success/15 text-success" : "bg-blue-500/15 text-blue-600 dark:text-blue-400"
      }`}
    >
      {ESTADO_LABEL[estado] ?? estado}
    </span>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{children ?? "—"}</p>
    </div>
  );
}

function Foto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (/^https?:\/\//.test(path)) {
      setUrl(path);
    } else {
      void getSignedUrl("cotizacion-fotos", path).then((u) => alive && setUrl(u));
    }
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <div className="h-24 w-24 animate-pulse rounded-md bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="Foto de la carga" loading="lazy" className="h-24 w-24 rounded-md border object-cover" />
    </a>
  );
}

function FichaOperacion() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useStaffIdentity();
  const roles = me?.roles ?? [];
  const puedeEditar = ["admin", "jefe_operaciones", "operador"].some((r) => roles.includes(r));

  const fetchOp = useServerFn(obtenerOperacion);
  const guardar = useServerFn(guardarOperacion);
  const avanzar = useServerFn(actualizarEstadoOperacion);

  const { data: op, isLoading, error } = useQuery({
    queryKey: ["operacion", id],
    queryFn: () => fetchOp({ data: { id } }),
  });

  const [form, setForm] = useState<Partial<Operacion>>({});
  useEffect(() => {
    if (op) setForm({});
  }, [op?.id]);

  const val = <K extends keyof Operacion>(k: K): Operacion[K] | undefined =>
    (form[k] !== undefined ? form[k] : op?.[k]) as Operacion[K] | undefined;
  const set = (patch: Partial<Operacion>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = useMemo(() => Object.keys(form).length > 0, [form]);

  const saveMut = useMutation({
    mutationFn: async () =>
      guardar({
        data: {
          id,
          descripcion_exacta: (val("descripcion_exacta") ?? null) as string | null,
          requerimientos_especiales: (val("requerimientos_especiales") ?? null) as string | null,
          notas_internas: (val("notas_internas") ?? null) as string | null,
          fecha_carga: (val("fecha_carga") ?? null) as string | null,
          precio_proveedor_confirmado_clp: (val("precio_proveedor_confirmado_clp") ?? null) as number | null,
          monto_adelanto_clp: (val("monto_adelanto_clp") ?? null) as number | null,
        },
      }),
    onSuccess: () => {
      toast.success("Ficha guardada");
      setForm({});
      void qc.invalidateQueries({ queryKey: ["operacion", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const avanzarMut = useMutation({
    mutationFn: (nuevo_estado: string) =>
      avanzar({ data: { operacion_id: id, nuevo_estado: nuevo_estado as never } }),
    onSuccess: (r) => {
      toast.success(`Estado actualizado: ${ESTADO_LABEL[r.estado] ?? r.estado}`);
      void qc.invalidateQueries({ queryKey: ["operacion", id] });
      void qc.invalidateQueries({ queryKey: ["operaciones-home"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar el estado"),
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando ficha…
      </p>
    );
  }
  if (error || !op) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h1 className="text-lg font-semibold">Operación no disponible</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "No se encontró la operación."}
        </p>
        <Link to="/operaciones" className="mt-3 inline-block text-sm text-primary hover:underline">
          ← Volver a Operaciones
        </Link>
      </div>
    );
  }

  const siguiente = puedeEditar ? SIGUIENTE[op.estado] : undefined;
  const onAvanzar = () => {
    if (!siguiente) return;
    if (siguiente.estado === "cobro_pendiente") {
      if (
        !window.confirm(
          "¿La operación fue completada? Esto devuelve el control al área Comercial para gestionar el cobro.",
        )
      )
        return;
    }
    avanzarMut.mutate(siguiente.estado);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary-soft p-2">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark sm:text-3xl">
              Operación N° {op.numero_operacion}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <EstadoBadge estado={op.estado} />
              {op.cotizacion_id && (
                <Link to="/comercial-cotizaciones" className="text-xs text-primary hover:underline">
                  Ver cotización original
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <DescargarDocumentoOperacion
            operacionId={id}
            tipo="oc_proveedor"
            visible={["admin", "jefe_operaciones", "operador", "lider_cuenta"].some((r) =>
              roles.includes(r),
            )}
          />
          <Link to="/operaciones" className="text-sm text-primary hover:underline">
            ← Operaciones
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Datos de la operación */}
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Datos de la operación
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Dato label="Contacto">{op.contacto_nombre ?? "—"}</Dato>
            <Dato label="Tipo de camión">{op.tipo_camion ?? "—"}</Dato>
            <Dato label="Origen">{op.origen ?? "—"}</Dato>
            <Dato label="Destino">{op.destino ?? "—"}</Dato>
            <Dato label="Peso">{op.peso_kg != null ? `${op.peso_kg} kg` : "—"}</Dato>
            <Dato label="Dimensiones">{op.dimensiones ?? "—"}</Dato>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Descripción exacta</span>
              <textarea
                rows={3}
                disabled={!puedeEditar}
                value={(val("descripcion_exacta") as string) ?? ""}
                onChange={(e) => set({ descripcion_exacta: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Requerimientos especiales</span>
              <textarea
                rows={2}
                disabled={!puedeEditar}
                value={(val("requerimientos_especiales") as string) ?? ""}
                onChange={(e) => set({ requerimientos_especiales: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="block sm:max-w-[220px]">
              <span className="mb-1 block text-xs text-muted-foreground">Fecha de carga</span>
              <input
                type="date"
                disabled={!puedeEditar}
                value={(val("fecha_carga") as string) ?? ""}
                onChange={(e) => set({ fecha_carga: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Notas internas</span>
              <textarea
                rows={2}
                disabled={!puedeEditar}
                value={(val("notas_internas") as string) ?? ""}
                onChange={(e) => set({ notas_internas: e.target.value })}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
          </div>
        </section>

        {/* Ejecución del viaje */}
        <EjecucionOperacionPanel operacionId={id} puedeEditar={puedeEditar} />

        {/* Asignación y precios */}
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Asignación y precios
          </h2>

          <AsignarChoferPanel
            operacionId={id}
            asignacionActiva={!!op.asignacion_id}
            choferNombre={op.chofer_nombre}
            camionPatente={op.camion_patente}
            puedeEditar={puedeEditar}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Dato label="Precio cliente">{clp(op.precio_ofrecido_cliente_clp)}</Dato>
            <Dato label="Precio máx. proveedor">{clp(op.precio_maximo_proveedor_clp)}</Dato>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Precio proveedor confirmado</span>
              <input
                type="number"
                min={0}
                disabled={!puedeEditar}
                value={(val("precio_proveedor_confirmado_clp") as number | null) ?? ""}
                onChange={(e) =>
                  set({ precio_proveedor_confirmado_clp: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Monto adelanto</span>
              <input
                type="number"
                min={0}
                disabled={!puedeEditar}
                value={(val("monto_adelanto_clp") as number | null) ?? ""}
                onChange={(e) =>
                  set({ monto_adelanto_clp: e.target.value === "" ? null : Number(e.target.value) })
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70"
              />
            </label>
          </div>

          {puedeEditar && (
            <button
              onClick={() => saveMut.mutate()}
              disabled={!dirty || saveMut.isPending}
              className="min-h-[44px] w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
            >
              {saveMut.isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          )}
        </section>
      </div>

      <PagoProveedorPanel
        operacionId={id}
        puedeEditar={puedeEditar}
        visible={["finalizada", "cobro_pendiente", "cerrada"].includes(op.estado)}
      />

      {/* Transiciones de estado */}
      {siguiente && (

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Avance de estado
          </h2>
          <button
            onClick={onAvanzar}
            disabled={avanzarMut.isPending}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
          >
            {avanzarMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {siguiente.label}
          </button>
        </section>
      )}

      {/* Fotos */}
      {(op.fotos.length > 0 || op.fotos_descarga.length > 0) && (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fotos</h2>
          {op.fotos.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Carga</p>
              <div className="flex flex-wrap gap-2">
                {op.fotos.map((p) => (
                  <Foto key={p} path={p} />
                ))}
              </div>
            </div>
          )}
          {op.fotos_descarga.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Descarga</p>
              <div className="flex flex-wrap gap-2">
                {op.fotos_descarga.map((p) => (
                  <Foto key={p} path={p} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
