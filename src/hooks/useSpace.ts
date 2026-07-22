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

  // Read pathname up-front so the initial load can honor deep links.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  // Dedupe route→space sync by target space (declared here so the initial
  // load effect can seed it and the sync effect below can read it).
  const lastSyncedTarget = useRef<Space | null>(null);

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
      // Prefer the current URL for deep links: query params / nested paths still
      // resolve to the correct space, avoiding a paint of the wrong space first.
      const routeHint = spaceFromPath(pathnameRef.current);
      const preferred = routeHint ?? remote ?? stored ?? undefined;
      let initial: Space = "proveedor";
      if (hasProv && hasChof) {
        initial = preferred === "chofer" || preferred === "proveedor" ? preferred : "proveedor";
      } else if (hasChof && !hasProv) {
        initial = "chofer";
      } else if (hasProv) {
        initial = "proveedor";
      } else {
        try { localStorage.removeItem(KEY); } catch {}
      }
      if (!rs.includes(ROLE_FOR_SPACE[initial])) {
        const fb = pickFallback(rs);
        if (fb) initial = fb;
      }
      setSpaceState(initial);
      spaceRef.current = initial;
      lastSyncedTarget.current = spaceFromPath(pathnameRef.current) ?? initial;
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
      reconcile(fresh, { silent: true, navigateOnFallback: true });
      return false;
    }
    const previous = spaceRef.current;
    setSpaceState(s);
    spaceRef.current = s;
    void persistSpace(s, userId, fresh);
    if (s !== previous) {
      toast.success(
        `Vista actualizada a ${s === "chofer" ? "Espacio Choferes" : "Portal Proveedor"}. Tu sesión sigue activa.`,
        { duration: 2500 }
      );
    }
    return true;
  }, [userId, reconcile, persistSpace]);

  const canSwitch = roles.includes("proveedor") && roles.includes("chofer");

  // Sync space with the current route (deep links like /dashboard/foo?x=1 or
  // /chofer/bar). Dedupe by *target space* (not pathname) so navigating
  // between sub-routes of the same space doesn't re-trigger, and use a quiet
  // local update (no re-fetch, no toast, no navigate) to avoid flicker or
  // overwriting the user's saved preference when they haven't chosen anything.
  useEffect(() => {
    if (!loaded) return;
    const target = spaceFromPath(pathname);
    if (!target) return;
    if (lastSyncedTarget.current === target && spaceRef.current === target) return;
    lastSyncedTarget.current = target;
    if (target === spaceRef.current) return;
    // Only reflect the route if the user actually has that role
    if (!roles.includes(ROLE_FOR_SPACE[target])) return;
    setSpaceState(target);
    spaceRef.current = target;
    // Persist quietly only for dual-role users so we don't clobber a single-role
    // user's stored preference with a passing deep link.
    if (canSwitch && userId) void persistSpace(target, userId, roles);
  }, [pathname, loaded, canSwitch, roles, userId, persistSpace]);

  return { space, setSpace, canSwitch, roles, loaded };
}

