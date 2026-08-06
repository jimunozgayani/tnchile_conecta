import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/login")({
  head: () => pageHead("/login", "Iniciar sesión · TN Chile Conecta", "Ingresa a tu cuenta del Portal TN Chile para gestionar camiones, choferes, documentos, tarifas y asignaciones de carga."),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast.error("No pudimos iniciar sesión con Google. Inténtalo de nuevo.");
      return;
    }
    if (result.redirected) return;
    localStorage.setItem("tn_last_activity", String(Date.now()));
    setGoogleLoading(false);
    await goAfterLogin();
  };

  const goAfterLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const rs = (roles ?? []).map((r: any) => r.role);
    if (rs.includes("admin")) navigate({ to: "/admin" });
    else if (rs.includes("cliente")) navigate({ to: "/cliente" });
    else if (rs.includes("chofer")) navigate({ to: "/chofer" });
    else navigate({ to: "/dashboard" });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) void goAfterLogin();
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check lockout BEFORE attempting sign-in
    const { data: locked } = await supabase.rpc("is_email_locked", { _email: email });
    if (locked === true) {
      setLoading(false);
      toast.error("Cuenta bloqueada temporalmente. Intenta en 15 minutos.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    // Record the attempt (fire-and-forget)
    supabase.from("login_attempts").insert({ user_email: email, success: !error }).then(() => {});

    setLoading(false);
    if (error) {
      // Re-check lockout after this failure to surface the lockout message immediately
      const { data: nowLocked } = await supabase.rpc("is_email_locked", { _email: email });
      if (nowLocked === true) toast.error("Cuenta bloqueada temporalmente. Intenta en 15 minutos.");
      else toast.error(error.message);
    } else {
      localStorage.setItem("tn_last_activity", String(Date.now()));
      toast.success("Sesión iniciada");
      await goAfterLogin();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft to-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex justify-center"><Logo variant="full" className="h-20 w-auto" /></div>
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-primary">TN Chile Conecta</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-primary-dark">Iniciar sesión</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">La logística la hacemos juntos.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Correo</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium">Contraseña</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">o</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <button type="button" onClick={handleGoogle} disabled={googleLoading}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60">
          <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z" />
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z" />
          </svg>
          {googleLoading ? "Conectando..." : "Continuar con Google"}
        </button>

        <div className="mt-4 flex justify-between text-sm">
          <Link to="/forgot-password" className="text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
          <Link to="/register" className="text-primary hover:underline">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
