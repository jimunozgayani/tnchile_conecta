import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/signed-url";

export type TipoDocumento = "oc_proveedor" | "ov_cliente";

export type DocumentoOperacion = {
  id: string;
  tipo: TipoDocumento;
  folio: string;
  pdf_storage_path: string | null;
};

const BUCKET = "documentos-operacion";

/**
 * Documento (OC/OV) asociado a una operación. Se puede resolver por
 * `operacionId` o por la cotización que la originó.
 */
export function useDocumentoOperacion({
  operacionId,
  cotizacionId,
  tipo,
}: {
  operacionId?: string | null;
  cotizacionId?: string | null;
  tipo: TipoDocumento;
}) {
  return useQuery({
    queryKey: ["documento-operacion", tipo, operacionId ?? null, cotizacionId ?? null],
    enabled: !!operacionId || !!cotizacionId,
    queryFn: async (): Promise<DocumentoOperacion | null> => {
      let opId = operacionId ?? null;
      if (!opId && cotizacionId) {
        const { data: op } = await supabase
          .from("operaciones")
          .select("id")
          .eq("cotizacion_id", cotizacionId)
          .is("deleted_at", null)
          .maybeSingle();
        opId = (op as { id: string } | null)?.id ?? null;
      }
      if (!opId) return null;

      const { data, error } = await supabase
        .from("documentos_operacion")
        .select("id, tipo, folio, pdf_storage_path")
        .eq("operacion_id", opId)
        .eq("tipo", tipo)
        .maybeSingle();
      if (error) throw error;
      return (data as DocumentoOperacion | null) ?? null;
    },
  });
}

/** Abre el PDF con una URL firmada fresca (1 hora). */
export async function abrirDocumentoOperacion(doc: DocumentoOperacion): Promise<void> {
  if (!doc.pdf_storage_path) throw new Error("El documento no tiene archivo asociado.");
  const url = await getSignedUrl(BUCKET, doc.pdf_storage_path);
  if (!url) throw new Error("No se pudo generar el enlace de descarga.");
  window.open(url, "_blank", "noopener,noreferrer");
}
