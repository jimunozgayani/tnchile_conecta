import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Identidad del usuario interno: nombre visible + roles. */
export function useStaffIdentity() {
  return useQuery({
    queryKey: ["staff-identity"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return { userId: null, nombre: "", roles: [] as string[] };

      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("nombre_contacto").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      return {
        userId: user.id,
        nombre: profile?.nombre_contacto?.trim() || user.email || "Usuario",
        roles: ((roles ?? []) as { role: string }[]).map((r) => r.role),
      };
    },
  });
}
