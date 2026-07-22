import { useEffect, useState, useCallback, useRef } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type Space = "proveedor" | "chofer";
const KEY = "tn.activeSpace";

function spaceFromPath(pathname: string): Space | null {
  if (pathname === "/chofer" || pathname.startsWith("/chofer/")) return "chofer";
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "proveedor";
  return null;
}

const ROLE_FOR_SPACE: Record<Space, string> = {
  proveedor: "proveedor",
  chofer: "chofer",
};

async function fetchRoles(userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as string);
}

export function useSpace() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [space, setSpaceState] = useState<Space>("proveedor");
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoaded(true); return; }
      setUserId(user.id);
      const [rs, { data: prefData }] = await Promise.all([
        fetchRoles(user.id),
        supabase.from("user_preferences" as any).select("active_space").eq("user_id", user.id).maybeSingle(),
      ]);
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

  const setSpace = useCallback(async (s: Space): Promise<boolean> => {
    if (!userId) return false;
    // Re-validate roles from DB before switching — the user may have lost the role
    const fresh = await fetchRoles(userId);
    setRoles(fresh);
    const required = ROLE_FOR_SPACE[s];
    if (!fresh.includes(required)) {
      toast.error(
        s === "chofer"
          ? "Ya no tienes acceso al espacio Chofer. Contacta al administrador si crees que es un error."
          : "Ya no tienes acceso al espacio Proveedor. Contacta al administrador si crees que es un error."
      );
      // If current space also became invalid, bounce to whatever they still have
      if (!fresh.includes(ROLE_FOR_SPACE[space])) {
        const fallback: Space | null = fresh.includes("proveedor")
          ? "proveedor"
          : fresh.includes("chofer")
            ? "chofer"
            : null;
        if (fallback) {
          setSpaceState(fallback);
          try { localStorage.setItem(KEY, fallback); } catch {}
          navigate({ to: fallback === "chofer" ? "/chofer" : "/dashboard" });
        } else {
          navigate({ to: "/" });
        }
      }
      return false;
    }
    setSpaceState(s);
    try { localStorage.setItem(KEY, s); } catch {}
    supabase
      .from("user_preferences" as any)
      .upsert({ user_id: userId, active_space: s }, { onConflict: "user_id" })
      .then(() => {});
    return true;
  }, [userId, space, navigate]);

  const canSwitch = roles.includes("proveedor") && roles.includes("chofer");

  // Sync space with the current route (e.g. deep link into /dashboard or /chofer)
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const lastSyncedPath = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded || !canSwitch) return;
    const target = spaceFromPath(pathname);
    if (!target) return;
    if (lastSyncedPath.current === pathname) return;
    lastSyncedPath.current = pathname;
    if (target !== space) void setSpace(target);
  }, [pathname, loaded, canSwitch, space, setSpace]);

  return { space, setSpace, canSwitch, roles, loaded };
}
