import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const inviteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ driver_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load driver (RLS lets owner see; admins also allowed)
    const { data: driver, error: dErr } = await supabase
      .from("drivers")
      .select("id,user_id,nombre_completo,email,rut")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!driver) throw new Error("Chofer no encontrado.");
    if (!driver.email) throw new Error("El chofer no tiene correo registrado. Edítalo y agrega un email.");

    // Insert invitation (RLS enforces owner-or-admin)
    const { data: inv, error: iErr } = await supabase
      .from("driver_invitations")
      .insert({ driver_id: driver.id, invited_by: userId })
      .select("token")
      .single();
    if (iErr) throw new Error(iErr.message);

    // Proveedor name (best effort)
    let proveedor: string | null = null;
    if (driver.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("razon_social")
        .eq("id", driver.user_id)
        .maybeSingle();
      proveedor = prof?.razon_social ?? null;
    }

    const { SITE_URL, invitacionChofer } = await import("./email/templates.server");
    const { enviarCorreo } = await import("./email/send.server");
    const link = `${SITE_URL}/invitacion-chofer/${inv.token}`;
    await enviarCorreo(
      driver.email,
      invitacionChofer({ nombre: driver.nombre_completo ?? null, proveedor, link }),
    );

    return { ok: true, email: driver.email };
  });
