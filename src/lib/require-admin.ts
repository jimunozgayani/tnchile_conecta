import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client-side admin gate for routes under /_app.
 *
 * The Supabase session lives in localStorage, so it does not exist during SSR.
 * Routes using this helper MUST also set `ssr: false` so `beforeLoad` runs only
 * in the browser; otherwise a hard reload renders on the server with no session
 * and bounces the user to /login even when they are signed in.
 */
async function myRoles(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/login" });

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return (roles ?? []).map((r: { role: string }) => r.role);
}

export async function requireAdmin() {
  const roles = await myRoles();
  if (!roles.includes("admin")) throw redirect({ to: "/dashboard" });
}

/** Espacio Operaciones: administradores y operadores. */
export async function requireOperations() {
  const roles = await myRoles();
  if (!roles.includes("admin") && !roles.includes("operador")) {
    throw redirect({ to: "/dashboard" });
  }
}
