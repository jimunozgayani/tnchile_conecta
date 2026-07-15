import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Truck } from "lucide-react";

export const Route = createFileRoute("/_app/chofer")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isChofer = (roles ?? []).some((r: any) => r.role === "chofer");
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isChofer && !isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: ChoferHome,
});

function ChoferHome() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
        <Truck className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-bold text-primary-dark">Bienvenido, Chofer</h1>
      <p className="text-lg text-muted-foreground">
        Este es tu espacio. Aquí verás tus asignaciones, cargas del día y
        documentos requeridos.
      </p>
      <p className="text-sm text-muted-foreground italic">
        Próximamente disponible. "La logística la hacemos juntos."
      </p>
    </div>
  );
}
