import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProveedorDirectoryRow = {
  id: string;
  razon_social: string | null;
  rut_empresa: string | null;
  region: string | null;
  correo: string | null;
  telefono: string | null;
  estado_doc: string | null; // 'vigente' | 'por_vencer' | 'vencido' | null
  trucks_count: number;
  drivers_count: number;
};

export const listProveedoresDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProveedorDirectoryRow[]> => {
    const { supabase, userId } = context;

    // Authorize: cliente or admin only
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const rs = (roles ?? []).map((r: any) => r.role);
    const isAdmin = rs.includes("admin");
    if (!rs.includes("cliente") && !isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Admins get full contact details; clients get a non-sensitive business directory
    // (no email, phone, or RUT) to prevent bulk PII scraping via self-signup.
    const selectCols = isAdmin
      ? "id, razon_social, rut_empresa, region, correo, telefono, estado_doc, deleted_at"
      : "id, razon_social, region, estado_doc, deleted_at";

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select(selectCols)
      .is("deleted_at", null);
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p: any) => p.id);
    if (ids.length === 0) return [];

    const [{ data: trucks }, { data: drivers }] = await Promise.all([
      supabaseAdmin.from("trucks").select("user_id").is("deleted_at", null).in("user_id", ids),
      supabaseAdmin.from("drivers").select("user_id").is("deleted_at", null).in("user_id", ids),
    ]);

    const truckCounts = new Map<string, number>();
    (trucks ?? []).forEach((t: any) => truckCounts.set(t.user_id, (truckCounts.get(t.user_id) ?? 0) + 1));
    const driverCounts = new Map<string, number>();
    (drivers ?? []).forEach((d: any) => driverCounts.set(d.user_id, (driverCounts.get(d.user_id) ?? 0) + 1));

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      razon_social: p.razon_social,
      rut_empresa: isAdmin ? p.rut_empresa : null,
      region: p.region,
      correo: isAdmin ? p.correo : null,
      telefono: isAdmin ? p.telefono : null,
      estado_doc: p.estado_doc,
      trucks_count: truckCounts.get(p.id) ?? 0,
      drivers_count: driverCounts.get(p.id) ?? 0,
    }));
  });
