import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Entradas públicas (sin sesión) que antes se invocaban como RPC directo desde
 * el navegador con el rol `anon`. Ahora pasan por el servidor de la aplicación,
 * que valida el payload y usa el cliente privilegiado; las funciones de base de
 * datos ya no son ejecutables por visitantes anónimos.
 */

const solicitudSchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  empresa: z.string().trim().max(200).optional().default(""),
  rut: z.string().trim().max(30).optional().default(""),
  telefono: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().email().max(255),
  origen: z.string().trim().max(300).optional().default(""),
  destinos: z.array(z.record(z.string(), z.unknown())).max(20).optional().default([]),
  tipo_camion_id: z.string().trim().max(60).optional().default(""),
  tipo_camion_otro: z.string().trim().max(200).optional().default(""),
  tipo_camion: z.string().trim().max(200).optional().default(""),
  peso_kg: z.string().trim().max(20).optional().default(""),
  largo_cm: z.string().trim().max(20).optional().default(""),
  ancho_cm: z.string().trim().max(20).optional().default(""),
  alto_cm: z.string().trim().max(20).optional().default(""),
  fecha_despacho: z.string().trim().max(20).optional().default(""),
  fotos: z.array(z.unknown()).max(20).optional().default([]),
  lineas_servicio: z.array(z.unknown()).max(20).optional().default([]),
  notas_admin: z.string().trim().max(4000).optional().default(""),
});

/** Crea la solicitud de carga del formulario público y devuelve su id. */
export const enviarSolicitudPublica = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => solicitudSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: id, error } = await supabaseAdmin.rpc("crear_solicitud_carga", {
      _payload: data as never,
    });
    if (error || !id) throw new Error("No pudimos registrar la solicitud.");
    return { id: id as string };
  });

/** Indica si un email está bloqueado por intentos fallidos (pre-login). */
export const emailBloqueado = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: locked } = await supabaseAdmin.rpc("is_email_locked", {
      _email: data.email,
    });
    return { locked: locked === true };
  });
