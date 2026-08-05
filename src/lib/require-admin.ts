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

/** Espacio Operaciones: administradores, jefes de operaciones y operadores. */
export async function requireOperations() {
  const roles = await myRoles();
  if (!["admin", "jefe_operaciones", "operador"].some((r) => roles.includes(r))) {
    throw redirect({ to: "/dashboard" });
  }
}

/** Espacio Comercial: administradores, líderes de cuenta y comerciales. */
export async function requireCommercial() {
  const roles = await myRoles();
  if (!["admin", "lider_cuenta", "comercial"].some((r) => roles.includes(r))) {
    throw redirect({ to: "/dashboard" });
  }
}
