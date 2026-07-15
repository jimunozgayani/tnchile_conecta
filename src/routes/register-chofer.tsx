import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { assignSelfRole } from "@/lib/self-signup.functions";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/register-chofer")({
  head: () => pageHead("/register-chofer", "Registro de choferes · Portal TN Chile", "Inscríbete como chofer en TN Chile: sube tu licencia y documentos, marca tu disponibilidad y recibe viajes asignados por operaciones."),
  component: RegisterChoferPage,
});

function RegisterChoferPage() {
  const navigate = useNavigate();
  const assignRole = useServerFn(assignSelfRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: nombre, portal: "chofer" },
      },
    });
    if (error) { setLoading(false); toast.error(error.message); return; }
    if (data.session) {
      try { await assignRole({ data: { role: "chofer" } }); } catch (e: any) { console.error(e); }
      toast.success("Cuenta creada");
      navigate({ to: "/chofer" });
    } else {
      toast.success("Revisa tu correo para confirmar la cuenta.");
      navigate({ to: "/login" });
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft to-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex justify-center"><Logo variant="full" className="h-20 w-auto" /></div>
        <h1 className="text-center text-2xl font-bold text-primary-dark">Crear cuenta Chofer</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Accede a tus asignaciones diarias.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Nombre completo</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium">Correo</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="block text-sm font-medium">Contraseña</label>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-50">
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          ¿Ya tienes cuenta? <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
