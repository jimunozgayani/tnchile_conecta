import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Download, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";
import { ALLOWED_UPLOAD_ACCEPT, validateUpload } from "@/lib/upload-validation";
import {
  listarComprobantesPagoProveedor,
  obtenerEstadoPagos,
  registrarCobroCliente,
  registrarComprobantePagoProveedor,
  registrarPagoProveedor,
  type ComprobantePago,
  type EstadoPagos,
} from "@/lib/pagos-cierre.functions";

const BUCKET_COMPROBANTES = "documentos-operacion";

const fmtFechaHora = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleString("es-CL");
};

/** Comprobantes de pago al proveedor: suben admin/jefe_operaciones, descarga todo el staff. */
export function ComprobantesPagoProveedor({
  operacionId,
  puedeSubir,
}: {
  operacionId: string;
  puedeSubir: boolean;
}) {
  const qc = useQueryClient();
  const listar = useServerFn(listarComprobantesPagoProveedor);
  const registrar = useServerFn(registrarComprobantePagoProveedor);
  const [subiendo, setSubiendo] = useState(false);

  const { data: comprobantes, isLoading } = useQuery({
    queryKey: ["comprobantes-pago", operacionId],
    queryFn: () => listar({ data: { operacion_id: operacionId } }),
  });

  const descargar = async (c: ComprobantePago) => {
    const url = await getSignedUrl(BUCKET_COMPROBANTES, c.path);
    if (!url) {
      toast.error("No se pudo generar el enlace de descarga");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onFile = async (file: File | null | undefined) => {
    if (!file) return;
    const check = validateUpload(file);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    setSubiendo(true);
    try {
      const limpio = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `comprobantes/${operacionId}/${Date.now()}-${limpio}`;
      const { error } = await supabase.storage
        .from(BUCKET_COMPROBANTES)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (error) throw new Error(error.message);
      await registrar({ data: { operacion_id: operacionId, path, nombre_archivo: file.name } });
      toast.success("Comprobante adjuntado");
      void qc.invalidateQueries({ queryKey: ["comprobantes-pago", operacionId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir el comprobante");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border p-3">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> Comprobantes de pago
      </h3>

      {puedeSubir && (
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Adjuntar comprobante (PDF, JPG o PNG, máx. 10 MB)
          </span>
          <input
            type="file"
            accept={ALLOWED_UPLOAD_ACCEPT}
            disabled={subiendo}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void onFile(f);
            }}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70"
          />
        </label>
      )}

      {subiendo && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Subiendo archivo…
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Cargando comprobantes…</p>
      ) : (comprobantes ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no hay comprobantes adjuntos.</p>
      ) : (
        <ul className="space-y-2">
          {(comprobantes ?? []).map((c) => (
            <li
              key={c.path}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.nombre_archivo}</span>
                <span className="text-muted-foreground">
                  {fmtFechaHora(c.subido_at)}
                  {c.subido_por_nombre ? ` · ${c.subido_por_nombre}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void descargar(c)}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 font-semibold hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Descargar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const clp = (v: number | null | undefined) =>
  v == null ? "—" : `$${Math.round(v).toLocaleString("es-CL")}`;

const fmtFecha = (s: string | null | undefined) => {
  if (!s) return "—";
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("es-CL");
};

const hoy = () => new Date().toISOString().slice(0, 10);

/** Indicador de 2 partes: qué lado ya resolvió y qué lado frena el cierre. */
export function IndicadorCierre({ pagos }: { pagos: EstadoPagos }) {
  if (!pagos) return null;
  const chip = (label: string, ok: boolean, hecho: string, pendiente: string) => (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        ok
          ? "bg-success/15 text-success"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Clock className="h-3 w-3" aria-hidden="true" />
      )}
      {label}: {ok ? hecho : pendiente}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip("Proveedor", !!pagos.fecha_pago_proveedor, "Pagado", "Pendiente")}
      {chip("Cliente", !!pagos.fecha_cobro_cliente, "Cobrado", "Pendiente")}
    </div>
  );
}

function useEstadoPagos(args: { operacion_id?: string; cotizacion_id?: string }) {
  const fetchPagos = useServerFn(obtenerEstadoPagos);
  const key = args.operacion_id ?? args.cotizacion_id ?? "none";
  return useQuery({
    queryKey: ["estado-pagos", key],
    queryFn: () => fetchPagos({ data: args }),
  });
}

const inputCls =
  "w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-70";

/** Sección "Pago a proveedor" de la ficha de operación (lado Operaciones). */
export function PagoProveedorPanel({
  operacionId,
  puedeEditar,
  visible,
  puedeSubirComprobante = false,
}: {
  operacionId: string;
  puedeEditar: boolean;
  visible: boolean;
  puedeSubirComprobante?: boolean;
}) {
  const qc = useQueryClient();
  const { data: pagos, isLoading } = useEstadoPagos({ operacion_id: operacionId });
  const registrar = useServerFn(registrarPagoProveedor);

  const [montoFinal, setMontoFinal] = useState("");
  const [fechaFinal, setFechaFinal] = useState("");
  const [montoAdelanto, setMontoAdelanto] = useState("");
  const [fechaAdelanto, setFechaAdelanto] = useState("");

  useEffect(() => {
    if (!pagos) return;
    setMontoFinal(pagos.monto_pago_proveedor_clp?.toString() ?? "");
    setFechaFinal(pagos.fecha_pago_proveedor ?? hoy());
    setMontoAdelanto(pagos.monto_adelanto_clp?.toString() ?? "");
    setFechaAdelanto(pagos.fecha_pago_adelanto ?? "");
  }, [pagos?.operacion_id, pagos?.fecha_pago_proveedor]);

  const mut = useMutation({
    mutationFn: () =>
      registrar({
        data: {
          operacion_id: operacionId,
          monto_pago_proveedor_clp: montoFinal === "" ? null : Number(montoFinal),
          fecha_pago_proveedor: fechaFinal || hoy(),
          monto_adelanto_clp: montoAdelanto === "" ? null : Number(montoAdelanto),
          fecha_pago_adelanto: fechaAdelanto || null,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.cerrada
          ? "Pago registrado. La operación quedó cerrada (proveedor y cliente resueltos)."
          : "Pago a proveedor registrado. Falta el cobro al cliente para cerrar.",
      );
      void qc.invalidateQueries({ queryKey: ["estado-pagos", operacionId] });
      void qc.invalidateQueries({ queryKey: ["operacion", operacionId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar el pago"),
  });

  if (!visible) return null;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pago a proveedor
        </h2>
        <IndicadorCierre pagos={pagos ?? null} />
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Cargando pagos…
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Costo confirmado al proveedor: {clp(pagos?.precio_proveedor_confirmado_clp)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Monto adelanto pagado</span>
              <input
                type="number"
                min={0}
                disabled={!puedeEditar}
                value={montoAdelanto}
                onChange={(e) => setMontoAdelanto(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Fecha del adelanto</span>
              <input
                type="date"
                disabled={!puedeEditar}
                value={fechaAdelanto}
                onChange={(e) => setFechaAdelanto(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                Monto pago final al proveedor
              </span>
              <input
                type="number"
                min={0}
                disabled={!puedeEditar}
                value={montoFinal}
                onChange={(e) => setMontoFinal(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Fecha del pago final</span>
              <input
                type="date"
                disabled={!puedeEditar}
                value={fechaFinal}
                onChange={(e) => setFechaFinal(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          {pagos?.fecha_pago_proveedor && (
            <p className="text-xs text-success">
              Pago al proveedor registrado el {fmtFecha(pagos.fecha_pago_proveedor)} por{" "}
              {clp(pagos.monto_pago_proveedor_clp)}.
            </p>
          )}

          {puedeEditar && (
            <button
              type="button"
              onClick={() => mut.mutate()}
              disabled={mut.isPending}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
            >
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {pagos?.fecha_pago_proveedor ? "Actualizar pago a proveedor" : "Registrar pago a proveedor"}
            </button>
          )}

          <ComprobantesPagoProveedor
            operacionId={operacionId}
            puedeSubir={puedeSubirComprobante}
          />
        </>
      )}
    </section>
  );
}

/** Sección "Cobro a cliente" del drawer de cotización (lado Comercial). */
export function CobroClientePanel({
  cotizacionId,
  puedeEditar,
  onCerrada,
}: {
  cotizacionId: string;
  puedeEditar: boolean;
  onCerrada?: () => void;
}) {
  const qc = useQueryClient();
  const { data: pagos, isLoading } = useEstadoPagos({ cotizacion_id: cotizacionId });
  const registrar = useServerFn(registrarCobroCliente);

  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");

  useEffect(() => {
    if (!pagos) return;
    setMonto(pagos.monto_cobro_cliente_clp?.toString() ?? pagos.precio_ofrecido_cliente_clp?.toString() ?? "");
    setFecha(pagos.fecha_cobro_cliente ?? hoy());
  }, [pagos?.operacion_id, pagos?.fecha_cobro_cliente]);

  const mut = useMutation({
    mutationFn: () =>
      registrar({
        data: {
          cotizacion_id: cotizacionId,
          monto_cobro_cliente_clp: monto === "" ? null : Number(monto),
          fecha_cobro_cliente: fecha || hoy(),
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.cerrada
          ? "Cobro registrado. La operación y la cotización quedaron cerradas."
          : "Cobro al cliente registrado. Falta el pago al proveedor para cerrar.",
      );
      void qc.invalidateQueries({ queryKey: ["estado-pagos", cotizacionId] });
      if (r.cerrada) onCerrada?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo registrar el cobro"),
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Cargando cobro…
      </p>
    );
  }
  // Sólo aplica cuando la operación ligada ya terminó físicamente.
  if (!pagos || !["finalizada", "cobro_pendiente", "cerrada"].includes(pagos.estado)) return null;

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cobro a cliente
        </p>
        <IndicadorCierre pagos={pagos} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Monto cobrado</span>
          <input
            type="number"
            min={0}
            disabled={!puedeEditar}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Fecha del cobro</span>
          <input
            type="date"
            disabled={!puedeEditar}
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {pagos.fecha_cobro_cliente && (
        <p className="text-[11px] text-success">
          Cobro registrado el {fmtFecha(pagos.fecha_cobro_cliente)} por {clp(pagos.monto_cobro_cliente_clp)}.
        </p>
      )}

      {puedeEditar && (
        <button
          type="button"
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
        >
          {mut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
          {pagos.fecha_cobro_cliente ? "Actualizar cobro a cliente" : "Registrar cobro a cliente"}
        </button>
      )}
    </div>
  );
}
