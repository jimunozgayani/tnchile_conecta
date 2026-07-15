import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSuppliersForChofer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Suppliers = users with 'supplier' role
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "supplier");
    if (rolesErr) throw new Error(rolesErr.message);
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) return [] as { id: string; razon_social: string | null }[];
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, razon_social")
      .in("id", ids)
      .is("deleted_at", null)
      .order("razon_social", { ascending: true });
    if (error) throw new Error(error.message);
    return (profiles ?? []) as { id: string; razon_social: string | null }[];
  });
