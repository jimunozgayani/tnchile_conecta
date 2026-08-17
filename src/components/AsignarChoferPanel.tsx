import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Truck, User, X } from "lucide-react";
import {
  asignarChoferManual,
  cancelarAsignacionOperacion,
  candidatosAsignacion,
} from "@/lib/asignacion-manual.functions";
import type { Candidato } from "@/lib/asignacion-manual.server";

function CandidatoRow({
  c,
  disabled,
  onConfirm,
}: {
  c: Candidato;
  disabled: boolean;
  onConfirm: (camionId: string) => void;
}) {
  const [camionId, setCamionId] = useState(c.trucks[0]?.id ?? "");
  const seleccionado = c.trucks.find((t) => t.id === camionId);
  return (
    <div className="flex flex-col justify-between gap-3 rounded-md border p-3 sm:flex-row sm:items-center">
      <div className="text-sm">
        <div className="flex items-center gap-2 font-medium">
          <User className="h-4 w-4 text-primary" />
          {c.nombre_completo}
          {seleccionado && !seleccionado.match && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              tipo sin verificar
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {c.proveedor_nombre ?? "Proveedor s/n"} · Licencia {c.clase_licencia ?? "—"} · RUT {c.rut ?? "—"}
          {c.disp_desde && (
            <>
              {" "}
              · Disp. {c.disp_desde}
              {c.disp_hasta ? ` → ${c.disp_hasta}` : ""}
              {c.disp_lugar ? ` desde ${c.disp_lugar}` : ""}
              {c.disp_destino ? ` hacia ${c.disp_destino}` : ""}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={camionId}
          onChange={(e) => setCamionId(e.target.value)}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          {c.trucks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.patente} · {t.tipo ?? "sin tipo"}
              {t.match ? "" : " (?)"}
            </option>
          ))}
        </select>
        <button
          disabled={disabled || !camionId}
          onClick={() => onConfirm(camionId)}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
        >
          Asignar
        </button>
      </div>
    </div>
  );
}

export function AsignarChoferPanel({
  operacionId,
  asignacionActiva,
  choferNombre,
  camionPatente,
  puedeEditar,
}: {
  operacionId: string;
  asignacionActiva: boolean;
  choferNombre: string | null;
  camionPatente: string | null;
  puedeEditar: boolean;
}) {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const listar = useServerFn(candidatosAsignacion);
  const asignar = useServerFn(asignarChoferManual);
  const cancelar = useServerFn(cancelarAsignacionOperacion);

  const { data, isLoading } = useQuery({
    queryKey: ["candidatos-asignacion", operacionId],
    queryFn: () => listar({ data: { operacion_id: operacionId } }),
    enabled: abierto && !asignacionActiva,
  });

  const refrescar = () => {
    void qc.invalidateQueries({ queryKey: ["operacion", operacionId] });
    void qc.invalidateQueries({ queryKey: ["mis-operaciones"] });
    void qc.invalidateQueries({ queryKey: ["candidatos-asignacion", operacionId] });
  };

  const asignarMut = useMutation({
    mutationFn: (v: { chofer_id: string; camion_id: string }) =>
      asignar({ data: { operacion_id: operacionId, ...v } }),
    onSuccess: () => {
      toast.success("Chofer asignado");
      setAbierto(false);
      refrescar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo asignar"),
  });

  const cancelarMut = useMutation({
    mutationFn: (reasignar: boolean) =>
      cancelar({ data: { operacion_id: operacionId } }).then(() => reasignar),
    onSuccess: (reasignar) => {
      toast.success(reasignar ? "Asignación liberada, elige un nuevo chofer" : "Asignación cancelada");
      setAbierto(reasignar);
      refrescar();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo cancelar"),
  });

  if (asignacionActiva) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <User className="h-4 w-4 text-primary" />
          {choferNombre ?? "Chofer sin nombre"}
        </p>
        <p className="flex items-center gap-2 text-muted-foreground">
          <Truck className="h-4 w-4" />
          {camionPatente ?? "Camión sin patente"}
        </p>
        {puedeEditar && (
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              disabled={cancelarMut.isPending}
              onClick={() => {
                if (window.confirm("Se liberará la asignación actual para elegir otro chofer. ¿Continuar?"))
                  cancelarMut.mutate(true);
              }}
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
            >
              Reasignar
            </button>
            <button
              disabled={cancelarMut.isPending}
              onClick={() => {
                if (window.confirm("¿Cancelar la asignación? La operación quedará sin chofer asignado."))
                  cancelarMut.mutate(false);
              }}
              className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              Cancelar asignación
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          Sin asignar
        </span>
        {puedeEditar && (
          <button
            onClick={() => setAbierto((v) => !v)}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-dark"
          >
            {abierto ? "Ocultar candidatos" : "Asignar chofer"}
          </button>
        )}
      </div>

      {abierto && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Choferes sugeridos {data ? `(${data.candidatos.length})` : ""}
            </h3>
            <button onClick={() => setAbierto(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          {data && (
            <p className="text-xs text-muted-foreground">
              Tipo requerido: {data.tipo_requerido ?? "no especificado (sin filtro de tipo)"} · Fecha de carga:{" "}
              {data.fecha_carga ?? "sin fecha"}
            </p>
          )}
          {data && !data.fecha_carga && (
            <p className="text-xs text-amber-700">
              Esta operación no tiene fecha de carga; no se puede filtrar por disponibilidad.
            </p>
          )}
          {isLoading ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando candidatos…
            </p>
          ) : (data?.candidatos.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay choferes aprobados disponibles con camión para esa fecha.
            </p>
          ) : (
            <div className="space-y-2">
              {data!.candidatos.map((c) => (
                <CandidatoRow
                  key={c.driver_id}
                  c={c}
                  disabled={asignarMut.isPending}
                  onConfirm={(camionId) =>
                    asignarMut.mutate({ chofer_id: c.driver_id, camion_id: camionId })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
