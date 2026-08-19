import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, UserCircle2, AlertTriangle, Loader2, Download, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";
import { Gate3Actions } from "@/components/Gate3Actions";
import { CotizacionEditForm } from "@/components/CotizacionEditForm";
import { HorarioEditForm } from "@/components/HorarioEditForm";
import { DescargarDocumentoOperacion } from "@/components/DescargarDocumentoOperacion";

import { fmtCLP } from "@/lib/regiones-capitales";
import { descargarCotizacionPDF } from "@/lib/cotizacion-pdf";
import { sellarCierre } from "@/lib/operaciones.functions";
import {
  actualizarCotizacion,
  actualizarEstadoCotizacion,
  asignarCotizacion,
  type Asignable,
} from "@/lib/cotizaciones.functions";

/** Acciones de transición disponibles por estado (etiquetas visibles). */
export const ACCIONES: Record<string, { estado: string; label: string }[]> = {
  cotizada: [
    { estado: "aceptada", label: "Marcar como aceptada" },
    { estado: "en_revision", label: "Poner en revisión" },
    { estado: "rechazada", label: "Rechazar" },
  ],
  aceptada: [{ estado: "lista_para_operar", label: "Sellar cierre" }],
  // El paso a 'cerrada' ya no es manual: ocurre cuando se registran el pago al
  // proveedor y el cobro al cliente (cierre paralelo).

};

export const ESTADO_LABEL: Record<string, string> = {
  nueva: "Nueva",
  pendiente: "Nueva",
  cotizada: "Cotizada",
  en_revision: "En revisión",
  aceptada: "Aceptada",
  lista_para_operar: "Cierre sellado",
  confirmada: "Lista para operar",
  en_operacion: "En operación",
  finalizada: "Finalizada",
  cobro_pendiente: "Cobro pendiente",
  cerrada: "Cerrada",
  rechazada: "Rechazada",
};

export const fmtFechaES = (s: string | null | undefined) => {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : s;
};

export const primerDestinoOf = (destinos: unknown): string => {
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

const fotoPaths = (fotos: unknown): string[] => {
  if (!Array.isArray(fotos)) return [];
  return fotos
    .map((f) => {
      if (typeof f === "string") return f;
      if (f && typeof f === "object") {
        const o = f as Record<string, unknown>;
        const v = o["path"] ?? o["storage_path"] ?? o["url"];
        if (typeof v === "string") return v;
      }
      return null;
    })
    .filter((v): v is string => !!v);
};

/** Modal de reasignación reutilizable (Kanban y ficha). */
export function ReasignarModal({
  id,
  asignables,
  onClose,
  onDone,
}: {
  id: string;
  asignables: Asignable[];
  onClose: () => void;
  onDone: (uid: string, nombre: string) => void;
}) {
  const asignar = useServerFn(asignarCotizacion);
  const [busy, setBusy] = useState<string | null>(null);

  const aplicar = async (a: Asignable) => {
    setBusy(a.id);
    try {
      await asignar({ data: { id, asignado_a: a.id } });
      toast.success(`Reasignada a ${a.nombre}`);
      onDone(a.id, a.nombre);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reasignar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm overflow-hidden rounded-lg border bg-card shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">Reasignar cotización</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-72 divide-y overflow-y-auto">
          {asignables.length === 0 && (
            <li className="px-4 py-4 text-xs text-muted-foreground">Sin usuarios asignables</li>
          )}
          {asignables.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{a.nombre}</span>
              </span>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void aplicar(a)}
                className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy === a.id ? "…" : "Asignar"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type Ficha = {
  id: string;
  estado: string;
  contacto_id: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_email: string | null;
  origen: string | null;
  destinos: unknown;
  tipo_camion: string | null;
  tipo_camion_id: string | null;
  tipo_camion_otro: string | null;
  peso_kg: number | null;
  largo_cm: number | null;
  ancho_cm: number | null;
  alto_cm: number | null;
  fecha_despacho: string | null;
  notas_admin: string | null;
  comentarios_revision: string | null;
  comentarios_rechazo: string | null;
  revision_count: number | null;
  asignado_a: string | null;
  precio_ofrecido_cliente_clp: number | null;
  presupuesto_referencial_cliente_clp: number | null;
  tipo_pago: string | null;
  validez_hasta: string | null;
  fotos: unknown;
  created_at: string;
  carga_hora_desde: string | null;
  carga_hora_hasta: string | null;
  descarga_fecha: string | null;
  descarga_hora_desde: string | null;
  descarga_hora_hasta: string | null;
  descarga_notas: string | null;
};

/** "HH:MM:SS" -> "HH:MM"; null -> "" */
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");
const rangoHoras = (desde: string | null, hasta: string | null) => {
  const d = hhmm(desde);
  const h = hhmm(hasta);
  if (d && h) return `${d} a ${h}`;
  if (d) return `desde ${d}`;
  if (h) return `hasta ${h}`;
  return "";
};


export function CotizacionDrawer({
  id,
  roles,
  asignables,
  nombreAsignado,
  onClose,
  onChanged,
}: {
  id: string;
  roles: string[];
  asignables: Asignable[];
  nombreAsignado?: string | undefined;
  onClose: () => void;
  onChanged: (patch: Record<string, unknown>) => void;
}) {
  const puedeTodo = ["admin", "lider_cuenta"].some((r) => roles.includes(r));
  const puedeNotas = puedeTodo || roles.includes("comercial");
  const puedeGate3 = ["admin", "lider_cuenta"].some((r) => roles.includes(r));
  const esComercial = roles.includes("comercial");

  const guardarNotas = useServerFn(actualizarCotizacion);
  const actualizarEstado = useServerFn(actualizarEstadoCotizacion);
  const sellar = useServerFn(sellarCierre);

  const [reasignar, setReasignar] = useState(false);
  const [asignadoNombre, setAsignadoNombre] = useState(nombreAsignado ?? "");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [comentarioPara, setComentarioPara] = useState<"en_revision" | "rechazada" | null>(null);
  const [prep, setPrep] = useState(false);
  const [editando, setEditando] = useState(false);
  const [editandoHorario, setEditandoHorario] = useState(false);


  const uidQuery = useQuery({
    queryKey: ["auth-uid"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const uid = uidQuery.data ?? null;

  const fichaQuery = useQuery({
    queryKey: ["cotizacion-ficha", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select(
          "id, estado, contacto_id, contacto_nombre, contacto_telefono, contacto_email, origen, destinos, tipo_camion, tipo_camion_id, tipo_camion_otro, peso_kg, largo_cm, ancho_cm, alto_cm, fecha_despacho, notas_admin, comentarios_revision, comentarios_rechazo, revision_count, asignado_a, precio_ofrecido_cliente_clp, presupuesto_referencial_cliente_clp, tipo_pago, validez_hasta, fotos, created_at, carga_hora_desde, carga_hora_hasta, descarga_fecha, descarga_hora_desde, descarga_hora_hasta, descarga_notas",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Ficha | null;
    },
  });
  const f = fichaQuery.data ?? null;

  useEffect(() => {
    if (f) setNotas(f.notas_admin ?? "");
  }, [f?.id, f?.notas_admin]);

  const paths = fotoPaths(f?.fotos);
  const fotosQuery = useQuery({
    queryKey: ["cotizacion-fotos", id, paths.length],
    enabled: paths.length > 0,
    queryFn: async () => {
      const urls = await Promise.all(paths.map((p) => getSignedUrl("cotizacion-fotos", p)));
      return urls.filter((u): u is string => !!u);
    },
  });

  const onBlurNotas = async () => {
    if (!puedeNotas || !f) return;
    if ((f.notas_admin ?? "") === notas.trim()) return;
    try {
      const res = await guardarNotas({ data: { id, notas_admin: notas } });
      onChanged({ notas_admin: res.notas_admin });
      void fichaQuery.refetch();
      toast.success("Notas guardadas");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar las notas");
    }
  };

  const aplicar = async (estado: string, comentario?: string) => {
    setBusy(true);
    try {
      const res = await actualizarEstado({ data: { id, estado, comentario: comentario ?? null } });
      onChanged({ estado: res.estado, revision_count: res.revision_count });
      if (estado === "lista_para_operar") {
        try {
          await sellar({ data: { cotizacion_id: id } });
          toast.success(
            "Cierre sellado. Pendiente de autorización de Admin/Líder de Cuenta para pasar a Operaciones.",
          );
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "No se pudo sellar el cierre.");
        }
      } else {
        toast.success("Estado actualizado");
      }
      setComentarioPara(null);
      void fichaQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado");
    } finally {
      setBusy(false);
    }
  };

  const generarPDF = async () => {
    setPdfBusy(true);
    try {
      await descargarCotizacionPDF(id);
      toast.success("PDF generado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  // El comercial puede corregir los datos de la carga de su propia cotización
  // mientras no esté en manos de operaciones.
  const esPropia = !!f && !!uid && f.asignado_a === uid;
  const puedeEditarCarga =
    puedeTodo || (esComercial && !!f && ["nueva", "pendiente", "cotizada"].includes(f.estado) && esPropia);
  // El horario puede seguir ajustándose con el cliente hasta 'aceptada'.
  const puedeEditarHorario =
    !puedeEditarCarga && esComercial && !!f && f.estado === "aceptada" && esPropia;


  const acciones = puedeTodo || roles.includes("comercial") ? (ACCIONES[f?.estado ?? ""] ?? []) : [];
  const revCount = f?.revision_count ?? 0;
  const puedePDF = f?.estado === "cotizada" || f?.estado === "aceptada";
  const faltantes = f
    ? [
        !f.origen ? "Origen" : null,
        primerDestinoOf(f.destinos) === "—" ? "Destino" : null,
        !f.tipo_camion ? "Tipo de camión" : null,
        !f.peso_kg ? "Peso" : null,
      ].filter((v): v is string => !!v)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        onClick={(e) => e.stopPropagation()}
        aria-label="Ficha de cotización"
        className="h-full w-full max-w-2xl overflow-y-auto border-l bg-card shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card px-5 py-3">
          <h2 className="text-base font-bold">Ficha de cotización</h2>
          <div className="flex items-center gap-2">
            {puedeEditarCarga && !editando && (
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                Editar
              </button>
            )}
            {puedeEditarHorario && !editandoHorario && (
              <button
                type="button"
                onClick={() => setEditandoHorario(true)}
                className="rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                Editar horario
              </button>
            )}
          <button type="button" aria-label="Cerrar" onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
          </div>
        </header>

        {fichaQuery.isLoading || !f ? (
          <div className="space-y-3 p-5">
            <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-24 animate-pulse rounded bg-muted" />
          </div>
        ) : editando ? (
          <div className="grid gap-6 p-5 md:grid-cols-2">
            <CotizacionEditForm
              ficha={f}
              soloCarga={!puedeTodo}
              onCancel={() => setEditando(false)}
              onSaved={(patch) => {
                onChanged(patch);
                setEditando(false);
                void fichaQuery.refetch();
              }}
            />
          </div>
        ) : editandoHorario ? (
          <div className="p-5">
            <HorarioEditForm
              ficha={f}
              onCancel={() => setEditandoHorario(false)}
              onSaved={(patch) => {
                onChanged(patch);
                setEditandoHorario(false);
                void fichaQuery.refetch();
              }}
            />
          </div>
        ) : (

          <div className="grid gap-6 p-5 md:grid-cols-2">
            {/* IZQUIERDA — contacto y carga */}
            <section className="space-y-3 text-sm">
              <p className="text-xl font-bold leading-tight">{f.contacto_nombre ?? "Sin contacto"}</p>
              <dl className="space-y-1.5">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Teléfono</dt>
                  <dd>
                    {f.contacto_telefono ? (
                      <a href={`tel:${f.contacto_telefono}`} className="text-primary hover:underline">
                        {f.contacto_telefono}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Email</dt>
                  <dd className="min-w-0 break-all">
                    {f.contacto_email ? (
                      <a href={`mailto:${f.contacto_email}`} className="text-primary hover:underline">
                        {f.contacto_email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Ruta</dt>
                  <dd>
                    {f.origen ?? "—"} → {primerDestinoOf(f.destinos)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Tipo camión</dt>
                  <dd>{f.tipo_camion || "Sin definir"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Peso</dt>
                  <dd>{f.peso_kg ? `${f.peso_kg.toLocaleString("es-CL")} kg` : "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Despacho</dt>
                  <dd>{fmtFechaES(f.fecha_despacho)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Horario carga</dt>
                  <dd>{rangoHoras(f.carga_hora_desde, f.carga_hora_hasta) || "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Descarga</dt>
                  <dd>
                    {f.descarga_fecha || f.descarga_hora_desde || f.descarga_hora_hasta
                      ? [fmtFechaES(f.descarga_fecha), rangoHoras(f.descarga_hora_desde, f.descarga_hora_hasta)]
                          .filter(Boolean)
                          .join(" · ")
                      : "—"}
                    {f.descarga_notas && (
                      <span className="block text-xs text-muted-foreground">{f.descarga_notas}</span>
                    )}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Precio</dt>
                  <dd className="font-semibold">{fmtCLP(f.precio_ofrecido_cliente_clp)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Presup. cliente</dt>
                  <dd className="text-muted-foreground">
                    {f.presupuesto_referencial_cliente_clp == null
                      ? "Sin dato"
                      : fmtCLP(f.presupuesto_referencial_cliente_clp)}
                  </dd>
                </div>
              </dl>

              {paths.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Fotos ({paths.length})
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {(fotosQuery.data ?? []).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer">
                        <img
                          src={u}
                          alt="Foto de la carga"
                          loading="lazy"
                          className="h-20 w-full rounded border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* DERECHA — gestión comercial */}
            <section className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {ESTADO_LABEL[f.estado] ?? f.estado}
                </span>
                {puedeTodo && (
                  <button
                    type="button"
                    onClick={() => setReasignar(true)}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    Reasignar
                  </button>
                )}
              </div>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserCircle2 className="h-4 w-4" aria-hidden="true" />
                Asignado a:{" "}
                <span className="font-medium text-foreground">
                  {asignadoNombre || (f.asignado_a ? "Asignada" : "Sin asignar")}
                </span>
              </p>

              {revCount > 0 && (
                <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Revisada {revCount}{" "}
                  {revCount === 1 ? "vez" : "veces"}
                </p>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium" htmlFor="ficha-notas">
                  Notas internas
                </label>
                <textarea
                  id="ficha-notas"
                  rows={5}
                  value={notas}
                  disabled={!puedeNotas}
                  onChange={(e) => setNotas(e.target.value)}
                  onBlur={() => void onBlurNotas()}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                />
                {puedeNotas && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Se guarda automáticamente al salir del campo.
                  </p>
                )}
              </div>

              {f.comentarios_revision && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  <p className="font-semibold">Comentario de revisión</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{f.comentarios_revision}</p>
                </div>
              )}
              {f.comentarios_rechazo && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="font-semibold">Motivo de rechazo</p>
                  <p className="mt-0.5 whitespace-pre-wrap">{f.comentarios_rechazo}</p>
                </div>
              )}
            </section>

            {/* ABAJO — acciones */}
            <div className="flex flex-wrap gap-2 border-t pt-4 md:col-span-2">
              {acciones.map((a) => (
                <button
                  key={a.estado}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (a.estado === "en_revision" || a.estado === "rechazada") {
                      setComentarioPara(a.estado);
                      return;
                    }
                    void aplicar(a.estado);
                  }}
                  className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
                >
                  {a.label}
                </button>
              ))}
              {(f.estado === "nueva" || f.estado === "pendiente") && (
                <button
                  type="button"
                  onClick={() => setPrep(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Preparar para exploración
                </button>
              )}
              <DescargarDocumentoOperacion
                cotizacionId={id}
                tipo="ov_cliente"
                visible={puedeTodo || esComercial}
              />
              {puedePDF && (
                <button
                  type="button"
                  disabled={pdfBusy}
                  onClick={() => void generarPDF()}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs hover:bg-muted disabled:opacity-60"
                >
                  {pdfBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {pdfBusy ? "Generando PDF…" : "Descargar PDF"}
                </button>
              )}
              {f.estado === "lista_para_operar" && puedeGate3 && (
                <Gate3Actions
                  id={f.id}
                  onDone={(patch: Record<string, unknown>) => {
                    onChanged(patch);
                    void fichaQuery.refetch();
                  }}
                />
              )}
            </div>

          </div>
        )}

        {reasignar && f && (
          <ReasignarModal
            id={f.id}
            asignables={asignables}
            onClose={() => setReasignar(false)}
            onDone={(uid, nombre) => {
              setAsignadoNombre(nombre);
              onChanged({ asignado_a: uid });
              void fichaQuery.refetch();
            }}
          />
        )}

        {comentarioPara && (
          <ComentarioSimple
            modo={comentarioPara}
            busy={busy}
            onCancel={() => setComentarioPara(null)}
            onSubmit={(txt) => void aplicar(comentarioPara, txt)}
          />
        )}

        {prep && f && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md space-y-3 rounded-lg border bg-card p-5 text-sm shadow-xl">
              <h2 className="text-base font-bold">Preparar para exploración</h2>
              <p className="text-xs text-muted-foreground">
                Antes de buscar transporte, confirma que los datos base estén completos.
              </p>
              <ul className="space-y-1 text-xs">
                <li>Origen: <span className="font-medium">{f.origen ?? "—"}</span></li>
                <li>Destino: <span className="font-medium">{primerDestinoOf(f.destinos)}</span></li>
                <li>Tipo de camión: <span className="font-medium">{f.tipo_camion || "—"}</span></li>
                <li>
                  Peso:{" "}
                  <span className="font-medium">
                    {f.peso_kg ? `${f.peso_kg.toLocaleString("es-CL")} kg` : "—"}
                  </span>
                </li>
              </ul>
              {faltantes.length > 0 ? (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                  Falta completar: {faltantes.join(", ")}. Edita la cotización antes de continuar.
                </p>
              ) : (
                <p className="rounded-md border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Datos completos: la carga está lista para la fase de exploración.
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPrep(false)}
                  className="rounded-md border px-4 py-2 text-sm"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={faltantes.length > 0}
                  onClick={() => {
                    toast.success("Cotización lista para exploración");
                    setPrep(false);
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

function ComentarioSimple({
  modo,
  busy,
  onCancel,
  onSubmit,
}: {
  modo: "en_revision" | "rechazada";
  busy: boolean;
  onCancel: () => void;
  onSubmit: (txt: string) => void;
}) {
  const [txt, setTxt] = useState("");
  const valido = txt.trim().length >= 10;

  // FIX 1 + FIX 2: portaling to document.body and stopping propagation on the
  // inner content box so clicks inside the modal never reach the parent
  // overlay's onClose handler.
  const content: ReactNode = (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valido) onSubmit(txt.trim());
        }}
        className="w-full max-w-md space-y-3 rounded-lg border bg-card p-5 text-sm shadow-xl"
      >
        <h2 className="text-base font-bold">
          {modo === "en_revision" ? "Poner en revisión" : "Rechazar cotización"}
        </h2>
        <textarea
          rows={4}
          required
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          placeholder="Comentario (mínimo 10 caracteres)"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        {/* FIX 3: visible character counter hint */}
        <p className="text-right text-xs text-muted-foreground">
          {txt.trim().length}/10 caracteres mínimo
        </p>
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

  // Render at the top level of the DOM to avoid stacking/scroll-context
  // issues with the drawer's overlay.
  return createPortal(content, document.body);
}
