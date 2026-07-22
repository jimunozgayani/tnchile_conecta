import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DriverInput = z.object({
  driver_id: z.string().uuid().optional(),
  nombre_completo: z.string().min(1),
  rut: z.string().min(3),
  email: z.string().email().optional().nullable(),
  celular: z.string().optional().nullable(),
  clase_licencia: z.string().min(1),
  licencia_vencimiento: z.string().optional().nullable(),
  carnet_vencimiento: z.string().optional().nullable(),
  foto_url: z.string().optional().nullable(),
});

/**
 * Saves a driver where the authenticated proveedor is themselves the chofer
 * ("dueño-conductor"). Creates or updates the driver row, grants the caller
 * the 'chofer' role (keeping existing roles), and links a chofer_perfiles row
 * so /chofer surfaces work. Documents still need to be uploaded/validated.
 */
export const saveOwnerDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DriverInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const driverPayload = {
      user_id: userId,
      nombre_completo: data.nombre_completo,
      rut: data.rut,
      email: data.email ? data.email.trim().toLowerCase() : null,
      celular: data.celular ?? null,
      clase_licencia: data.clase_licencia,
      licencia_vencimiento: data.licencia_vencimiento || null,
      carnet_vencimiento: data.carnet_vencimiento || null,
      foto_url: data.foto_url || null,
    };

    let driverId = data.driver_id;
    if (driverId) {
      // Ensure the caller owns the driver row before updating
      const { data: existing, error: eErr } = await supabaseAdmin
        .from("drivers")
        .select("id,user_id")
        .eq("id", driverId)
        .maybeSingle();
      if (eErr) throw new Error(eErr.message);
      if (!existing || existing.user_id !== userId)
        throw new Error("No autorizado sobre este chofer.");
      const { error } = await supabaseAdmin
        .from("drivers")
        .update(driverPayload)
        .eq("id", driverId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("drivers")
        .insert(driverPayload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      driverId = created.id;
    }

    // Grant 'chofer' role without touching existing 'proveedor' role
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "chofer" }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (rErr) throw new Error(rErr.message);

    // Link chofer_perfiles so /chofer views work; keep as 'pendiente' until docs approved.
    // Use upsert on (user_id, proveedor_id) if a perfil already exists.
    const { data: existingPerfil } = await supabaseAdmin
      .from("chofer_perfiles")
      .select("user_id")
      .eq("user_id", userId)
      .eq("proveedor_id", userId)
      .maybeSingle();
    if (!existingPerfil) {
      const { error: pErr } = await supabaseAdmin.from("chofer_perfiles").insert({
        user_id: userId,
        proveedor_id: userId,
        nombre: data.nombre_completo,
        rut: data.rut,
        licencia_numero: data.clase_licencia,
        estado_validacion: "pendiente",
      });
      if (pErr) throw new Error(pErr.message);
    }

    return { ok: true, driver_id: driverId };
  });
