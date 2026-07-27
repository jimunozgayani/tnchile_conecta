import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StaffRole = "admin" | "operador";
export const STAFF_ROLES: StaffRole[] = ["admin", "operador"];

export type AppUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  razon_social: string | null;
  roles: string[];
};

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Solo administradores.");
  }
}

function siteUrl() {
  return (
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "https://tnchile-proveedores.lovable.app"
  );
}

export const listAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AppUser[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const users: any[] = [];
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      users.push(...(data?.users ?? []));
      if ((data?.users?.length ?? 0) < 200) break;
    }

    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, razon_social");

    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as string);
      rolesByUser.set(r.user_id, list);
    }
    const nameById = new Map((profiles ?? []).map((p: any) => [p.id, p.razon_social]));

    return users
      .map((u) => ({
        id: u.id as string,
        email: (u.email ?? "") as string,
        created_at: u.created_at as string,
        last_sign_in_at: (u.last_sign_in_at ?? null) as string | null,
        razon_social: (nameById.get(u.id) ?? null) as string | null,
        roles: rolesByUser.get(u.id) ?? [],
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  });

export const setStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "operador"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // No puedes quitarte tu propio rol de admin (evita quedarse sin administradores).
    if (!data.grant && data.role === "admin" && data.user_id === context.userId) {
      throw new Error("No puedes quitarte tu propio rol de administrador.");
    }

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: data.role } as any, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email().max(255),
        role: z.enum(["admin", "operador"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();

    // ¿Ya existe la cuenta?
    let userId: string | null = null;
    for (let page = 1; page <= 10 && !userId; page++) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      const found = (list?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email);
      if (found) userId = found.id;
      if ((list?.users?.length ?? 0) < 200) break;
    }

    let invited = false;
    if (!userId) {
      const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { brand: "TN Chile", tagline: "La logística la hacemos juntos.", staff_role: data.role },
        redirectTo: `${siteUrl()}/reset-password`,
      });
      if (error) throw new Error(error.message);
      userId = inv?.user?.id ?? null;
      invited = true;
    }
    if (!userId) throw new Error("No se pudo crear la cuenta para ese correo.");

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: data.role } as any, { onConflict: "user_id,role" });
    if (rErr) throw new Error(rErr.message);

    return { ok: true, email, invited };
  });
