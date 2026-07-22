import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Status = "pendiente" | "usada" | "expirada" | "invalida";

export const getDriverInvitationByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(8) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("driver_invitations")
      .select("id,estado,expires_at,driver_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return { status: "invalida" as Status };

    const { data: drv } = await supabaseAdmin
      .from("drivers")
      .select("id,nombre_completo,email,rut,user_id")
      .eq("id", inv.driver_id)
      .maybeSingle();

    // Determine if the driver has already been claimed via chofer_perfiles
    let claimed = false;
    if (drv?.rut && drv?.user_id) {
      const rutNorm = drv.rut.replace(/[^0-9kK]/g, "").toLowerCase();
      const { data: perfiles } = await supabaseAdmin
        .from("chofer_perfiles")
        .select("user_id,rut,proveedor_id,estado_validacion")
        .eq("proveedor_id", drv.user_id);
      claimed = !!(perfiles ?? []).find(
        (p) => (p.rut ?? "").replace(/[^0-9kK]/g, "").toLowerCase() === rutNorm,
      );
    }

    let status: Status = "pendiente";
    if (inv.estado === "usada" || claimed) status = "usada";
    else if (inv.estado !== "pendiente" || new Date(inv.expires_at).getTime() < Date.now())
      status = "expirada";

    return {
      status,
      driverName: drv?.nombre_completo ?? null,
      email: drv?.email ?? null,
    };
  });

export const activateDriverInvitation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ token: z.string().min(8), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv, error: iErr } = await supabaseAdmin
      .from("driver_invitations")
      .select("id,estado,expires_at,driver_id")
      .eq("token", data.token)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!inv) throw new Error("Invitación no encontrada.");
    if (inv.estado !== "pendiente") throw new Error("Esta invitación ya fue usada o revocada.");
    if (new Date(inv.expires_at).getTime() < Date.now())
      throw new Error("Esta invitación ha expirado.");

    const { data: drv, error: dErr } = await supabaseAdmin
      .from("drivers")
      .select("id,user_id,nombre_completo,email,rut,clase_licencia")
      .eq("id", inv.driver_id)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!drv) throw new Error("Chofer no encontrado.");
    if (!drv.email) throw new Error("El chofer no tiene correo registrado.");
    if (!drv.rut) throw new Error("El chofer no tiene RUT registrado.");

    // Ensure not already claimed
    const rutNorm = drv.rut.replace(/[^0-9kK]/g, "").toLowerCase();
    const { data: perfiles } = await supabaseAdmin
      .from("chofer_perfiles")
      .select("user_id,rut,proveedor_id")
      .eq("proveedor_id", drv.user_id);
    const already = (perfiles ?? []).find(
      (p) => (p.rut ?? "").replace(/[^0-9kK]/g, "").toLowerCase() === rutNorm,
    );
    if (already) throw new Error("Esta invitación ya fue usada.");

    // Create auth user
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: drv.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { role: "chofer", driver_id: drv.id },
    });
    if (cErr || !created?.user) throw new Error(cErr?.message ?? "No se pudo crear la cuenta.");
    const newUid = created.user.id;

    // Link via chofer_perfiles (approved, so the driver can access their space)
    const { error: pErr } = await supabaseAdmin.from("chofer_perfiles").insert({
      user_id: newUid,
      nombre: drv.nombre_completo ?? drv.email,
      rut: drv.rut,
      licencia_numero: drv.clase_licencia ?? "N/A",
      proveedor_id: drv.user_id,
      estado_validacion: "aprobado",
    });
    if (pErr) {
      // rollback the auth user to avoid orphans
      await supabaseAdmin.auth.admin.deleteUser(newUid).catch(() => {});
      throw new Error(pErr.message);
    }

    // Mark invitation used
    await supabaseAdmin
      .from("driver_invitations")
      .update({ estado: "usada", used_at: new Date().toISOString() })
      .eq("id", inv.id);

    return { ok: true, email: drv.email };
  });
