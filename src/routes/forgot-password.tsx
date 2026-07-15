import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => pageHead("/forgot-password", "Recuperar contraseña · Portal TN Chile", "Solicita un enlace para restablecer la contraseña de tu cuenta del Portal TN Chile de proveedores, clientes y choferes."),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { setSent(true); toast.success("Correo enviado"); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft to-background px-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex justify-center"><Logo variant="full" className="h-20 w-auto" /></div>
        <h1 className="text-center text-2xl font-bold text-primary-dark">Recuperar contraseña</h1>
        {sent ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Revisa tu correo para restablecer tu contraseña.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="email" required placeholder="tu@correo.cl" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <button type="submit" disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60">
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  );
}
