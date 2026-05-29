import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InviteSchema = z.object({
  email: z.string().email().max(255),
  company_name: z.string().max(255).optional().nullable(),
  rut: z.string().max(20).optional().nullable(),
});

export const inviteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;

    // Verify caller is admin
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("Solo administradores pueden invitar.");

    const email = data.email.trim().toLowerCase();
    const company = data.company_name?.trim() || null;
    const rut = data.rut?.trim() || null;

    const siteUrl =
      process.env.SITE_URL ||
      process.env.PUBLIC_SITE_URL ||
      "https://tnchile-proveedores.lovable.app";

    // Send Supabase Auth invite
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        company_name: company,
        rut,
        brand: "TN Chile",
        tagline: "La logística la hacemos juntos.",
      },
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (inviteErr && !/already.*registered|exists/i.test(inviteErr.message)) {
      throw new Error(inviteErr.message);
    }

    // Upsert invitation record
    const { error: upsertErr } = await supabaseAdmin
      .from("supplier_invitations")
      .upsert(
        {
          email,
          company_name: company,
          rut,
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
