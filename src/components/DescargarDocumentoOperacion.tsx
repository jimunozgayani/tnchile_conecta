import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import {
  abrirDocumentoOperacion,
  useDocumentoOperacion,
  type TipoDocumento,
} from "@/hooks/useDocumentoOperacion";

const LABEL: Record<TipoDocumento, string> = {
  oc_proveedor: "OC",
  ov_cliente: "OV",
};

/**
 * Botón de descarga de la OC/OV de una operación. No se muestra si el
 * documento aún no existe (Gate 3 no autorizado).
 */
export function DescargarDocumentoOperacion({
  operacionId,
  cotizacionId,
  tipo,
  visible = true,
}: {
  operacionId?: string | null;
  cotizacionId?: string | null;
  tipo: TipoDocumento;
  visible?: boolean;
}) {
  const { data: doc } = useDocumentoOperacion({ operacionId, cotizacionId, tipo });
  const [busy, setBusy] = useState(false);

  if (!visible || !doc?.pdf_storage_path) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      await abrirDocumentoOperacion(doc);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el documento");
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
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {tipo === "oc_proveedor" ? "Descargar Orden de Compra" : "Descargar Orden de Venta"} (
      {LABEL[tipo]} {doc.folio})
    </button>
  );
}
