import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Camera, Loader2, MapPin, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";
import { validateUpload } from "@/lib/upload-validation";
import { CameraOrFileInput } from "@/components/CameraOrFileInput";
import { ESTADO_VIAJE_LABEL, SIGUIENTE_VIAJE, tipoFotoPara } from "@/lib/ejecucion-viaje";
import {
  avanzarEstadoViaje,
  obtenerEjecucion,
  type EventoViajeItem,
} from "@/lib/ejecucion-operacion.functions";

function EventoFoto({ evento }: { evento: EventoViajeItem }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (evento.storage_path) {
      void getSignedUrl("viaje-eventos", evento.storage_path).then((u) => alive && setUrl(u));
    }
    return () => {
      alive = false;
    };
  }, [evento.storage_path]);

  return (
    <figure className="space-y-1">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={evento.tipo}
            loading="lazy"
            className="h-24 w-full rounded-md border object-cover"
          />
        </a>
      ) : (
        <div className="h-24 w-full animate-pulse rounded-md bg-muted" />
      )}
      <figcaption className="text-[10px] leading-tight text-muted-foreground">
        {evento.tipo === "foto_descarga" ? "Descarga" : evento.tipo === "foto_carga" ? "Carga" : "Guía"} ·{" "}
        {evento.autor}
      </figcaption>
    </figure>
  );
}

export function EjecucionOperacionPanel({
  operacionId,
  puedeEditar,
}: {
  operacionId: string;
  puedeEditar: boolean;
}) {
  const qc = useQueryClient();
  const fetchEjecucion = useServerFn(obtenerEjecucion);
  const avanzar = useServerFn(avanzarEstadoViaje);

  const [file, setFile] = useState<File | null>(null);
  const [nota, setNota] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ejecucion-operacion", operacionId],
    queryFn: () => fetchEjecucion({ data: { operacion_id: operacionId } }),
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!data?.asignacion_id || !siguiente) throw new Error("Sin asignación activa.");
      let storagePath: string | undefined;
      if (file) {
        const v = validateUpload(file);
        if (!v.ok) throw new Error(v.error);
        const tipo = tipoFotoPara(siguiente.estado) ?? "foto_guia";
        const ext = file.name.split(".").pop() || "jpg";
        const folder = data.driver_user_id ?? "staff";
        const path = `${folder}/${data.asignacion_id}/${tipo}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
          .from("viaje-eventos")
          .upload(path, file, { contentType: file.type });
        if (error) throw error;
        storagePath = path;
      }
      return avanzar({
        data: {
          asignacion_id: data.asignacion_id,
          nuevo_estado: siguiente.estado as never,
          ...(storagePath ? { storage_path: storagePath } : {}),
          ...(nota.trim() ? { nota: nota.trim() } : {}),
        },
      });
    },
    onSuccess: (r) => {
      toast.success(
        r.operacion_finalizada ? "Viaje entregado. Operación finalizada." : "Estado del viaje actualizado.",
      );
      setFile(null);
      setNota("");
      void qc.invalidateQueries({ queryKey: ["ejecucion-operacion", operacionId] });
      void qc.invalidateQueries({ queryKey: ["operacion", operacionId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "No se pudo actualizar el estado."),
  });

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl border bg-muted/40" />;
  }
  if (!data?.asignacion_id) return null;

  const estado = data.estado_viaje ?? "por_iniciar";
  const siguiente = SIGUIENTE_VIAJE[estado];
  const pedirFoto = siguiente && (siguiente.estado === "cargando" || siguiente.estado === "descargando");
  const fotos = data.eventos.filter((e) => e.storage_path);
  const notas = data.eventos.filter((e) => e.tipo === "nota" && e.nota);

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ejecución de la operación
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Truck className="h-3.5 w-3.5" />
          {ESTADO_VIAJE_LABEL[estado] ?? estado}
        </span>
      </div>

      {data.chofer_nombre && (
        <p className="text-sm text-muted-foreground">
          Chofer asignado: <span className="font-medium text-foreground">{data.chofer_nombre}</span>
        </p>
      )}

      {estado === "en_ruta" && (
        <div className="rounded-lg border border-dashed p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <MapPin className="h-4 w-4 text-primary" />
            Última ubicación declarada:{" "}
            {data.ultima_ubicacion
              ? `${data.ultima_ubicacion.lugar} — ${data.ultima_ubicacion.fecha}`
              : "sin registro"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">No es ubicación en tiempo real.</p>
        </div>
      )}

      {puedeEditar && siguiente && (
        <div className="space-y-3">
          {pedirFoto && (
            <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                <Camera className="h-4 w-4" />
                Foto (opcional): {siguiente.estado === "cargando" ? "carga / guía" : "descarga"}
              </p>
              <CameraOrFileInput onFile={(f) => setFile(f)} disabled={mut.isPending} accept="image/*,application/pdf" />
              {file && <p className="mt-2 text-xs text-muted-foreground">Seleccionada: {file.name}</p>}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Nota (opcional)</span>
            <textarea
              rows={2}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              disabled={mut.isPending}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </label>

          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50 sm:w-auto"
          >
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {siguiente.label}
          </button>
        </div>
      )}

      {!siguiente && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">
          Viaje entregado.
        </p>
      )}

      {fotos.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Fotos del viaje ({fotos.length})
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {fotos.map((e) => (
              <EventoFoto key={e.id} evento={e} />
            ))}
          </div>
        </div>
      )}

      {notas.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas del viaje</p>
          {notas.map((n) => (
            <p key={n.id} className="rounded-md border p-2 text-xs">
              <span className="font-medium">{n.autor}:</span> {n.nota}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
