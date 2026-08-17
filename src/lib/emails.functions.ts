import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Bienvenida al proveedor que acaba de activar su cuenta. */
export const enviarBienvenidaProveedor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data: perfil } = await supabase
      .from("profiles")
      .select("razon_social, nombre_contacto, correo, bienvenida_enviada_at")
      .eq("id", userId)
      .maybeSingle();
    // Solo la primera activación de cuenta recibe la bienvenida.
    if (!perfil || perfil.bienvenida_enviada_at) return { ok: false, skipped: true };

    const email = (perfil.correo as string | null) || (claims as { email?: string }).email || null;
    const { bienvenidaProveedor } = await import("./email/templates.server");
    const { enviarCorreoSeguro } = await import("./email/send.server");
    const res = await enviarCorreoSeguro(
      email,
      bienvenidaProveedor({
        nombre_contacto: (perfil.nombre_contacto as string | null) ?? null,
        razon_social: (perfil.razon_social as string | null) ?? null,
      }),
    );
    await supabase
      .from("profiles")
      .update({ bienvenida_enviada_at: new Date().toISOString() })
      .eq("id", userId);
    return res;
  });


/** Aviso por correo de un mensaje interno recién creado. */
export const enviarNotificacionMensaje = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ mensaje_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msg } = await supabase
      .from("mensajes")
      .select("id, de_usuario_id, para_proveedor_id, asunto, contenido")
      .eq("id", data.mensaje_id)
      .maybeSingle();
    if (!msg) throw new Error("Mensaje no encontrado.");
    if (msg.de_usuario_id !== userId) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dest } = await supabaseAdmin
      .from("profiles")
      .select("correo, nombre_contacto, razon_social")
      .eq("id", msg.para_proveedor_id)
      .maybeSingle();
    let email = (dest?.correo as string | null) ?? null;
    if (!email) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(msg.para_proveedor_id);
      email = u?.user?.email ?? null;
    }

    const { data: emisor } = await supabaseAdmin
      .from("profiles")
      .select("nombre_contacto, razon_social")
      .eq("id", userId)
      .maybeSingle();

    const { notificacionMensaje } = await import("./email/templates.server");
    const { enviarCorreoSeguro } = await import("./email/send.server");
    return enviarCorreoSeguro(
      email,
      notificacionMensaje({
        nombre:
          (dest?.nombre_contacto as string | null) || (dest?.razon_social as string | null) || null,
        remitente:
          (emisor?.nombre_contacto as string | null) ||
          (emisor?.razon_social as string | null) ||
          "Equipo TN Chile",
        asunto: msg.asunto as string,
        preview: msg.contenido as string,
      }),
    );
  });

/** Confirmación al usuario de que su documento quedó registrado. */
export const enviarConfirmacionDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documento_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: doc } = await supabase
      .from("documents")
      .select("id, user_id, tipo, nombre, vencimiento")
      .eq("id", data.documento_id)
      .maybeSingle();
    if (!doc) throw new Error("Documento no encontrado.");
    if (doc.user_id !== userId) throw new Error("Sin permisos.");

    const { data: perfil } = await supabase
      .from("profiles")
      .select("correo, nombre_contacto, razon_social")
      .eq("id", userId)
      .maybeSingle();
    const email = (perfil?.correo as string | null) || (claims as { email?: string }).email || null;
    const nombre =
      (perfil?.nombre_contacto as string | null) || (perfil?.razon_social as string | null) || null;

    const { confirmacionDocumento } = await import("./email/templates.server");
    const { enviarCorreoSeguro } = await import("./email/send.server");
    return enviarCorreoSeguro(
      email,
      confirmacionDocumento({
        nombre,
        doc_tipo: doc.tipo as string,
        nombre_archivo: (doc.nombre as string | null) ?? null,
        subido_por: nombre,
        vencimiento: (doc.vencimiento as string | null) ?? null,
      }),
    );
  });

/** Envío de prueba de cualquier plantilla (solo admin). */
export const enviarCorreoPrueba = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        plantilla: z.enum([
          "bienvenida_proveedor",
          "bienvenida_chofer",
          "alerta_vencimiento",
          "notificacion_mensaje",
          "confirmacion_documento",
          "invitacion_proveedor",
        ]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Solo administradores.");

    const t = await import("./email/templates.server");
    const { enviarCorreo } = await import("./email/send.server");
    const correos: Record<string, { subject: string; html: string }> = {
      bienvenida_proveedor: t.bienvenidaProveedor({
        nombre_contacto: "Juan Ignacio",
        razon_social: "Transportes Demo SpA",
      }),
      bienvenida_chofer: t.bienvenidaChofer({
        nombre_completo: "Juan Ignacio",
        proveedor: "Transportes Demo SpA",
      }),
      alerta_vencimiento: t.alertaVencimiento({
        nombre: "Juan Ignacio",
        proveedor: "Transportes Demo SpA",
        doc_tipo: "Revisión técnica",
        entity_name: "Camión ABCD-12",
        fecha_vencimiento: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10),
        dias_restantes: 7,
      }),
      notificacion_mensaje: t.notificacionMensaje({
        nombre: "Juan Ignacio",
        remitente: "Equipo TN Chile",
        asunto: "Coordinación de carga Santiago → Antofagasta",
        preview: "Hola, necesitamos confirmar el camión para el despacho del viernes.",
      }),
      confirmacion_documento: t.confirmacionDocumento({
        nombre: "Juan Ignacio",
        doc_tipo: "Póliza de seguro",
        nombre_archivo: "poliza-2026.pdf",
        subido_por: "Juan Ignacio",
        vencimiento: new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10),
      }),
      invitacion_proveedor: t.invitacionProveedor({
        nombre: "Juan Ignacio",
        empresa: "Transportes Demo SpA",
        link: `${t.SITE_URL}/reset-password`,
      }),
    };

    const id = await enviarCorreo(data.to, correos[data.plantilla]!);
    return { ok: true, id };
  });
