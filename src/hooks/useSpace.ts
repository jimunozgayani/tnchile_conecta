import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Space = "proveedor" | "chofer";
const KEY = "tn.activeSpace";

export function useSpace() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [space, setSpaceState] = useState<Space>("proveedor");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const rs = (data ?? []).map((r: any) => r.role as string);
      setRoles(rs);
      const hasProv = rs.includes("proveedor");
      const hasChof = rs.includes("chofer");
      const stored = (typeof window !== "undefined" ? localStorage.getItem(KEY) : null) as Space | null;
      let initial: Space = "proveedor";
      if (hasProv && hasChof) {
        initial = stored === "chofer" || stored === "proveedor" ? stored : "proveedor";
      } else if (hasChof && !hasProv) {
        initial = "chofer";
      }
      setSpaceState(initial);
      setLoaded(true);
    })();
  }, []);

  const setSpace = useCallback((s: Space) => {
    setSpaceState(s);
    try { localStorage.setItem(KEY, s); } catch {}
  }, []);

  const canSwitch = roles.includes("proveedor") && roles.includes("chofer");
  return { space, setSpace, canSwitch, roles, loaded };
}
