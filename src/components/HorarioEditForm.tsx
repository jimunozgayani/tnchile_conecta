import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { actualizarCotizacionCompleta } from "@/lib/cotizaciones.functions";
import {
  HorarioCargaDescargaFields,
  hhmm,
  type HorarioValues,
} from "@/components/HorarioCargaDescargaFields";

export type HorarioFicha = {
  id: string;
  carga_hora_desde: string | null;
  carga_hora_hasta: string | null;
  descarga_fecha: string | null;
  descarga_hora_desde: string | null;
  descarga_hora_hasta: string | null;
  descarga_notas: string | null;
};

/**
 * Edición compacta SOLO de las ventanas horarias de carga y descarga.
 * La usa el comercial cuando la cotización ya está aceptada y el operador
 * durante la exploración.
 */
export function HorarioEditForm({
  ficha,
  onCancel,
  onSaved,
  titulo = "Editar horario",
}: {
  ficha: HorarioFicha;
  onCancel: () => void;
  onSaved: (patch: Record<string, unknown>) => void;
  titulo?: string;
}) {
  const guardar = useServerFn(actualizarCotizacionCompleta);
  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<HorarioValues>({
    carga_hora_desde: hhmm(ficha.carga_hora_desde),
    carga_hora_hasta: hhmm(ficha.carga_hora_hasta),
    descarga_fecha: ficha.descarga_fecha ?? "",
    descarga_hora_desde: hhmm(ficha.descarga_hora_desde),
    descarga_hora_hasta: hhmm(ficha.descarga_hora_hasta),
    descarga_notas: ficha.descarga_notas ?? "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        id: ficha.id,
        carga_hora_desde: v.carga_hora_desde || null,
        carga_hora_hasta: v.carga_hora_hasta || null,
        descarga_fecha: v.descarga_fecha || null,
        descarga_hora_desde: v.descarga_hora_desde || null,
        descarga_hora_hasta: v.descarga_hora_hasta || null,
        descarga_notas: v.descarga_notas || null,
      };
      await guardar({ data: payload as never });
      toast.success("Horario actualizado");
      onSaved(payload as Record<string, unknown>);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el horario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3">
      <p className="text-sm font-semibold">{titulo}</p>
      <HorarioCargaDescargaFields
        idPrefix={`hor-${ficha.id.slice(0, 8)}`}
        value={v}
        onChange={(p) => setV((prev) => ({ ...prev, ...p }))}
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? "Guardando…" : "Guardar horario"}
        </button>
      </div>
    </form>
  );
}
