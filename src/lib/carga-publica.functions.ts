import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_SIZE = 10 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const schema = z.object({
  contentType: z.string().refine((v) => v in EXT_BY_MIME, "Formato no permitido"),
  /** Contenido del archivo codificado en base64 (sin prefijo data:). */
  base64: z.string().min(1).max(Math.ceil((MAX_SIZE * 4) / 3) + 1024),
});

/**
 * Sube un archivo del formulario público de carga. La subida se hace en el
 * servidor para que el bucket no requiera una política de INSERT anónima.
 */
export const subirArchivoCargaPublica = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_SIZE) {
      throw new Error("El archivo supera el tamaño permitido.");
    }

    const ext = EXT_BY_MIME[data.contentType]!;
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("carga-publica")
      .upload(path, bytes, { contentType: data.contentType, upsert: false });
    if (error) throw new Error("No se pudo subir el archivo.");

    return { path };
  });
