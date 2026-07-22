import { useEffect, useState, useCallback, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export type Space = "proveedor" | "chofer";
const KEY = "tn.activeSpace";

function spaceFromPath(pathname: string): Space | null {
  if (pathname === "/chofer" || pathname.startsWith("/chofer/")) return "chofer";
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "proveedor";
  return null;
}

export function useSpace() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [space, setSpaceState] = useState<Space>("proveedor");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      setUserId(user.id);
      const [{ data: rolesData }, { data: prefData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("user_preferences" as any).select("active_space").eq("user_id", user.id).maybeSingle(),
      ]);
      const rs = (rolesData ?? []).map((r: any) => r.role as string);
      setRoles(rs);
      const hasProv = rs.includes("proveedor");
      const hasChof = rs.includes("chofer");
      const remote = (prefData as any)?.active_space as Space | undefined;
      const stored = (typeof window !== "undefined" ? localStorage.getItem(KEY) : null) as Space | null;
      const preferred = remote ?? stored ?? undefined;
      let initial: Space = "proveedor";
      if (hasProv && hasChof) {
        initial = preferred === "chofer" || preferred === "proveedor" ? preferred : "proveedor";
      } else if (hasChof && !hasProv) {
        initial = "chofer";
      }
      setSpaceState(initial);
      if (preferred) {
        try { localStorage.setItem(KEY, initial); } catch {}
      }
      setLoaded(true);
    })();
  }, []);

  const setSpace = useCallback((s: Space) => {
    setSpaceState(s);
    try { localStorage.setItem(KEY, s); } catch {}
    if (userId) {
      supabase
        .from("user_preferences" as any)
        .upsert({ user_id: userId, active_space: s }, { onConflict: "user_id" })
        .then(() => {});
    }
  }, [userId]);

  const canSwitch = roles.includes("proveedor") && roles.includes("chofer");
  return { space, setSpace, canSwitch, roles, loaded };
}
