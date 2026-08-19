import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generarAsignacionPDF } from "@/lib/asignacion-pdf.functions";

/**
 * Descarga la "Asignación de transporte" (chofer, patentes y horarios). El PDF
 * se genera al primer clic y se reutiliza si nada cambió desde entonces.
 */
export function DescargarAsignacion({
  operacionId,
  cotizacionId,
  visible = true,
}: {
  operacionId?: string | null;
  cotizacionId?: string | null;
  visible?: boolean;
}) {
  const generar = useServerFn(generarAsignacionPDF);
  const [busy, setBusy] = useState(false);

  if (!visible || (!operacionId && !cotizacionId)) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const r = await generar({
        data: {
          ...(operacionId ? { operacion_id: operacionId } : {}),
          ...(!operacionId && cotizacionId ? { cotizacion_id: cotizacionId } : {}),
        },
      });
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar la asignación");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      data-stop
      disabled={busy}
      onClick={() => void onClick()}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      Descargar Asignación
    </button>
  );
}
