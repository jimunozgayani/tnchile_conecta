import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/invitacion-chofer/$token")({
  head: () => pageHead("/invitacion-chofer", "Activar cuenta de chofer · TN Chile", "Activa tu cuenta de chofer en el portal TN Chile usando el enlace de invitación que recibiste por correo."),
  component: InvitacionChoferPage,
});

function InvitacionChoferPage() {
  const { token } = useParams({ from: "/invitacion-chofer/$token" });
  const [state, setState] = useState<"loading" | "ok" | "expired" | "used" | "invalid">("loading");
  const [driverName, setDriverName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // Sign in-independent lookup would need a public RPC. For now, ask user to sign in.
      const { data, error } = await supabase
        .from("driver_invitations")
        .select("estado,expires_at,driver:driver_id(nombre_completo)")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) { setState("invalid"); return; }
      setDriverName((data as any).driver?.nombre_completo ?? null);
      if (data.estado === "usada") setState("used");
      else if (data.estado !== "pendiente" || new Date(data.expires_at).getTime() < Date.now()) setState("expired");
      else setState("ok");
    })();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-soft to-background px-4 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-lg">
        <div className="mb-6 flex justify-center"><Logo variant="full" className="h-20 w-auto" /></div>
        {state === "loading" && <p className="text-muted-foreground">Validando invitación...</p>}
        {state === "ok" && (
          <>
            <h1 className="text-2xl font-bold text-primary-dark">Bienvenido{driverName ? `, ${driverName}` : ""}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Crea tu cuenta para activar tu perfil de chofer en TN Chile.</p>
            <Link to="/register-chofer" className="mt-6 inline-block rounded-md bg-primary px-6 py-2.5 font-medium text-primary-foreground hover:bg-primary-dark">Crear mi cuenta</Link>
            <p className="mt-4 text-xs text-muted-foreground">¿Ya tienes cuenta? <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link></p>
          </>
        )}
        {state === "expired" && (
          <>
            <h1 className="text-2xl font-bold text-destructive">Invitación expirada</h1>
            <p className="mt-2 text-sm text-muted-foreground">Este enlace ya no es válido. Pide a tu proveedor que te envíe una nueva invitación.</p>
          </>
        )}
        {state === "used" && (
          <>
            <h1 className="text-2xl font-bold">Invitación ya utilizada</h1>
            <p className="mt-2 text-sm text-muted-foreground">Esta invitación ya fue usada. <Link to="/login" className="text-primary hover:underline">Inicia sesión</Link>.</p>
          </>
        )}
        {state === "invalid" && (
          <>
            <h1 className="text-2xl font-bold text-destructive">Enlace no válido</h1>
            <p className="mt-2 text-sm text-muted-foreground">Verifica el enlace en tu correo o solicita una nueva invitación.</p>
          </>
        )}
      </div>
    </div>
  );
}
