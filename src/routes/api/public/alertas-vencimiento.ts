import { createFileRoute } from "@tanstack/react-router";

/**
 * Envía por correo las alertas de documentos por vencer que aún no fueron notificadas.
 * Endpoint interno para el job programado; requiere el header x-cron-secret.
 */
export const Route = createFileRoute("/api/public/alertas-vencimiento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["EMAIL_CRON_SECRET"];
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { alertaVencimiento } = await import("@/lib/email/templates.server");
        const { enviarCorreoSeguro } = await import("@/lib/email/send.server");

        const { data: pendientes, error } = await supabaseAdmin
          .from("notificaciones")
          .select("id, user_id, entity_name, doc_tipo, fecha_vencimiento, dias_restantes")
          .is("email_enviada_at", null)
          .order("created_at", { ascending: true })
          .limit(100);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        let enviados = 0;
        for (const n of pendientes ?? []) {
          const { data: perfil } = await supabaseAdmin
            .from("profiles")
            .select("correo, nombre_contacto, razon_social")
            .eq("id", n.user_id)
            .maybeSingle();
          let email = perfil?.correo ?? null;
          if (!email) {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(n.user_id);
            email = u?.user?.email ?? null;
          }

          const res = await enviarCorreoSeguro(
            email,
            alertaVencimiento({
              nombre: perfil?.nombre_contacto ?? null,
              proveedor: perfil?.razon_social ?? null,
              doc_tipo: n.doc_tipo,
              entity_name: n.entity_name ?? null,
              fecha_vencimiento: n.fecha_vencimiento,
              dias_restantes: n.dias_restantes,
            }),
          );
          if (res.ok) enviados += 1;
          await supabaseAdmin
            .from("notificaciones")
            .update({ email_enviada_at: new Date().toISOString() })
            .eq("id", n.id);
        }

        return Response.json({ ok: true, revisados: (pendientes ?? []).length, enviados });
      },
    },
  },
});
