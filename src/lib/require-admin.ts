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
export async function requireAdmin() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw redirect({ to: "/login" });

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw redirect({ to: "/dashboard" });
  }
}
