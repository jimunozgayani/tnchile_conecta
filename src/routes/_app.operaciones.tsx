import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Phone, Package, CalendarClock, ArrowRightLeft } from "lucide-react";

export const Route = createFileRoute("/_app/operaciones")({
  beforeLoad: async () => {
    const { redirect } = await import("@tanstack/react-router");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/dashboard" });
  },
  component: OperacionesPage,
});

const SECTIONS = [
  { icon: ClipboardList, title: "Cotizaciones", desc: "Solicitudes de cotización enviadas por clientes.", to: "/operaciones-cotizaciones" },
  { icon: Phone, title: "Contactos", desc: "Directorio operativo: clientes, proveedores, contrapartes." },
  { icon: Package, title: "Cargas", desc: "Registro y seguimiento de cargas en curso." },
  { icon: ArrowRightLeft, title: "Asignaciones", desc: "Asignación de camiones y choferes a cargas." },
  { icon: CalendarClock, title: "Disponibilidad", desc: "Vista operativa de disponibilidad de flota." },
];

function OperacionesPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-primary-dark">Operaciones</h1>
        <p className="text-sm text-muted-foreground">
          Espacio operativo diario. Independiente de Administración.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary-soft p-2">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{desc}</p>
            <span className="mt-4 inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              Próximamente
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
