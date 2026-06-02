import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InviteSchema = z.object({
  email: z.string().email().max(255),
  company_name: z.string().max(255).optional().nullable(),
  rut: z.string().max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
  if (!isAdmin) throw new Error("Solo administradores.");
}

function siteUrl() {
  return (
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "https://tnchile-proveedores.lovable.app"
  );
}

async function sendInvite(email: string, company: string | null, rut: string | null) {
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: {
      company_name: company,
      rut,
      brand: "TN Chile",
      tagline: "La logística la hacemos juntos.",
    },
    redirectTo: `${siteUrl()}/reset-password`,
  });
  if (error && !/already.*registered|exists/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export const inviteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    const email = data.email.trim().toLowerCase();
    const company = data.company_name?.trim() || null;
    const rut = data.rut?.trim() || null;
    const notes = data.notes?.trim() || null;

    await sendInvite(email, company, rut);

    const { error: upsertErr } = await supabaseAdmin
      .from("supplier_invitations")
      .upsert(
        {
          email,
          company_name: company,
          rut,
          notes,
          status: "invited" as const,
          invited_at: new Date().toISOString(),
          invited_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );
    if (upsertErr) throw new Error(upsertErr.message);

    return { ok: true, email };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    const { data: inv, error } = await supabaseAdmin
      .from("supplier_invitations")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !inv) throw new Error("Invitación no encontrada.");

    await sendInvite(inv.email, inv.company_name, inv.rut);

    const { error: upErr } = await supabaseAdmin
      .from("supplier_invitations")
      .update({ invited_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const setSupplierSuspension = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ email: z.string().email(), suspended: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    await assertAdmin(supabase, userId);

    const email = data.email.trim().toLowerCase();
    const newStatus = data.suspended ? "suspended" : "active";

    const { error } = await supabaseAdmin
      .from("supplier_invitations")
      .upsert(
        {
          email,
          status: newStatus as any,
          invited_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      );
    if (error) throw new Error(error.message);
    return { ok: true, status: newStatus };
  });
