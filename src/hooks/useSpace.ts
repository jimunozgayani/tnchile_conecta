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

function pickFallback(rs: string[]): Space | null {
  if (rs.includes("proveedor")) return "proveedor";
  if (rs.includes("chofer")) return "chofer";
  return null;
}

export function useSpace() {
  const [roles, setRoles] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [space, setSpaceState] = useState<Space>("proveedor");
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const spaceRef = useRef<Space>("proveedor");
  useEffect(() => { spaceRef.current = space; }, [space]);

  // Persist to DB + localStorage. Skip persistence if the user no longer has that role.
  const persistSpace = useCallback(async (s: Space, uid: string, rs: string[]) => {
    if (!rs.includes(ROLE_FOR_SPACE[s])) return;
    try { localStorage.setItem(KEY, s); } catch {}
    void supabase
      .from("user_preferences" as any)
      .upsert({ user_id: uid, active_space: s }, { onConflict: "user_id" });
  }, []);

  // Core reconciliation: given fresh roles, ensure the active space is still valid.
  // Returns the resolved space (or null if user has neither role).
  const reconcile = useCallback(
    (fresh: string[], opts: { silent?: boolean; navigateOnFallback?: boolean } = {}): Space | null => {
      const prev = roles;
      setRoles(fresh);
      const current = spaceRef.current;
      const currentOk = fresh.includes(ROLE_FOR_SPACE[current]);
      if (currentOk) {
        // If they just gained a role, no forced switch — keep current.
        return current;
      }
      const fallback = pickFallback(fresh);
      if (!opts.silent) {
        const lostProv = prev.includes("proveedor") && !fresh.includes("proveedor");
        const lostChof = prev.includes("chofer") && !fresh.includes("chofer");
        if (fallback) {
          toast.info(
            `Tu acceso al espacio ${current === "chofer" ? "Chofer" : "Proveedor"} fue removido. ` +
            `Cambiamos automáticamente a ${fallback === "chofer" ? "Chofer" : "Proveedor"}.`
          );
        } else if (lostProv || lostChof) {
          toast.error("Ya no tienes acceso a los espacios de Proveedor ni Chofer.");
        }
      }
      if (fallback) {
        setSpaceState(fallback);
        spaceRef.current = fallback;
        if (userId) void persistSpace(fallback, userId, fresh);
        if (opts.navigateOnFallback) {
          navigate({ to: fallback === "chofer" ? "/chofer" : "/dashboard" });
        }
      } else if (opts.navigateOnFallback) {
        navigate({ to: "/" });
      }
      return fallback;
    },
    [roles, userId, persistSpace, navigate],
  );

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
      } else if (hasProv) {
        initial = "proveedor";
      } else {
        // No relevant role — leave default but clear stale local preference.
        try { localStorage.removeItem(KEY); } catch {}
      }
      // Reconcile stored preference against actual roles (defensive)
      if (!rs.includes(ROLE_FOR_SPACE[initial])) {
        const fb = pickFallback(rs);
        if (fb) initial = fb;
      }
      setSpaceState(initial);
      spaceRef.current = initial;
      if (rs.includes(ROLE_FOR_SPACE[initial])) {
        void persistSpace(initial, user.id, rs);
      }
      setLoaded(true);
    })();
  }, [persistSpace]);

  // Auto-revalidate roles: on window focus, and via realtime subscription to user_roles.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const revalidate = async (silent = false) => {
      const fresh = await fetchRoles(userId);
      if (cancelled) return;
      reconcile(fresh, { silent, navigateOnFallback: false });
    };
    const onFocus = () => { void revalidate(false); };
    window.addEventListener("focus", onFocus);
    const ch = (supabase as any)
      .channel(`user-roles-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${userId}` },
        () => { void revalidate(false); },
      )
      .subscribe();
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      try { (supabase as any).removeChannel(ch); } catch {}
    };
  }, [userId, reconcile]);

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
      // Reconcile current space in case it also became invalid
      reconcile(fresh, { silent: true, navigateOnFallback: true });
      return false;
    }
    setSpaceState(s);
    spaceRef.current = s;
    void persistSpace(s, userId, fresh);
    return true;
  }, [userId, reconcile, persistSpace]);

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
