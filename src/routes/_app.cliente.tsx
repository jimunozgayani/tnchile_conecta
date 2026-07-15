import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_app/cliente")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isCliente = (roles ?? []).some((r: any) => r.role === "cliente");
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isCliente && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: ClienteHome,
});

function ClienteHome() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
        <Building2 className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-bold text-primary-dark">Bienvenido a TN Chile</h1>
      <p className="text-lg text-muted-foreground">
        Este es tu espacio como cliente. Aquí podrás solicitar cotizaciones,
        ver el estado de tus cargas y coordinar tus envíos.
      </p>
      <p className="text-sm text-muted-foreground italic">
        Próximamente disponible. "La logística la hacemos juntos."
      </p>
    </div>
  );
}
