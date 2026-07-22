import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Users, DollarSign, FileText, Briefcase, RefreshCw } from "lucide-react";
import type { Space } from "@/hooks/useSpace";

const PROVEEDOR_TABS = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/camiones", label: "Equipos", icon: Truck },
  { to: "/choferes", label: "Choferes", icon: Users },
  { to: "/tarifas", label: "Tarifas", icon: DollarSign },
  { to: "/documentos", label: "Docs", icon: FileText },
] as const;

const CHOFER_TABS = [
  { to: "/chofer", label: "Inicio", icon: LayoutDashboard },
  { to: "/mis-viajes", label: "Viajes", icon: Briefcase },
  { to: "/mi-disponibilidad-chofer", label: "Disponibilidad", icon: Truck },
] as const;

type Props = {
  space?: Space;
  setSpace?: (s: Space) => Promise<boolean> | boolean | void;
};

export function MobileBottomNav({ space, setSpace }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const canSwitch = !!space && !!setSpace;
  const tabs = space === "chofer" ? CHOFER_TABS : PROVEEDOR_TABS;
  const cols = canSwitch ? tabs.length + 1 : tabs.length;

  const toggleSpace = async () => {
    if (!setSpace || !space) return;
    const next: Space = space === "chofer" ? "proveedor" : "chofer";
    const ok = await Promise.resolve(setSpace(next));
    if (ok !== false) navigate({ to: next === "chofer" ? "/chofer" : "/dashboard" });
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
      aria-label="Navegación inferior"
    >
      {tabs.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="flex min-h-[56px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            style={{ color: active ? "#2D7A45" : "hsl(var(--muted-foreground))" }}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
      {canSwitch && (
        <button
          type="button"
          onClick={toggleSpace}
          role="switch"
          aria-checked={space === "chofer"}
          aria-label={`Espacio activo: ${space === "chofer" ? "Chofer" : "Proveedor"}. Cambiar a ${space === "chofer" ? "Proveedor" : "Chofer"}`}
          className="flex min-h-[56px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          style={{ color: "#2D7A45" }}
        >
          <RefreshCw className="h-5 w-5" aria-hidden="true" />
          <span>{space === "chofer" ? "Proveedor" : "Chofer"}</span>
        </button>
      )}
    </nav>
  );
}
