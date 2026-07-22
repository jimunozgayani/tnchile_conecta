import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import {
  getDriverInvitationByToken,
  activateDriverInvitation,
} from "@/lib/driver-invitations-public.functions";

export const Route = createFileRoute("/invitacion-chofer/$token")({
  head: () => pageHead(
    "/invitacion-chofer",
    "Activar cuenta de chofer · TN Chile",
    "Activa tu cuenta de chofer en el portal TN Chile usando el enlace de invitación que recibiste por correo.",
  ),
  component: InvitacionChoferPage,
});

type Status = "loading" | "pendiente" | "usada" | "expirada" | "invalida";

function InvitacionChoferPage() {
  const { token } = useParams({ from: "/invitacion-chofer/$token" });
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [driverName, setDriverName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await getDriverInvitationByToken({ data: { token } });
        setStatus(res.status);
        setDriverName(res.driverName ?? null);
        setEmail(res.email ?? null);
      } catch {
        setStatus("invalida");
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    if (!email) return setError("No hay correo asociado a esta invitación.");
    setSubmitting(true);
    try {
      await activateDriverInvitation({ data: { token, password } });
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;
      navigate({ to: "/chofer" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo activar la cuenta.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft to-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <Logo variant="full" className="h-20 w-auto" />
        </div>

        {status === "loading" && (
          <p className="text-center text-muted-foreground">Validando invitación...</p>
        )}

        {status === "pendiente" && (
          <>
            <h1 className="text-center text-2xl font-bold text-primary-dark">
              Bienvenido{driverName ? `, ${driverName}` : ""}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Crea tu contraseña para activar tu cuenta de chofer en TN Chile.
            </p>
            <p className="mt-1 text-center text-xs italic text-primary-dark">
              La logística la hacemos juntos.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Correo</label>
                <input
                  type="email"
                  value={email ?? ""}
                  readOnly
                  className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-primary px-6 py-2.5 font-medium text-primary-foreground hover:bg-primary-dark disabled:opacity-60"
              >
                {submitting ? "Activando..." : "Crear mi cuenta"}
              </button>
            </form>
          </>
        )}

        {status === "expirada" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Invitación expirada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este enlace ya no es válido. Contacta a tu proveedor para que te envíe una nueva
              invitación.
            </p>
          </div>
        )}

        {status === "usada" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Esta invitación ya fue usada</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ya existe una cuenta activa para este chofer. Si eres tú,{" "}
              <a href="/login" className="text-primary hover:underline">
                inicia sesión
              </a>
              . Si no reconoces esto, contacta a tu proveedor.
            </p>
          </div>
        )}

        {status === "invalida" && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-destructive">Enlace no válido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifica el enlace en tu correo o solicita una nueva invitación a tu proveedor.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
