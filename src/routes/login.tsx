import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goAfterLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    navigate({ to: isAdmin ? "/admin" : "/dashboard" });
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
        <h1 className="text-center text-2xl font-bold text-primary-dark">Iniciar sesión</h1>
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

        <div className="mt-4 flex justify-between text-sm">
          <Link to="/forgot-password" className="text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
          <Link to="/register" className="text-primary hover:underline">Crear cuenta</Link>
        </div>
      </div>
    </div>
  );
}
