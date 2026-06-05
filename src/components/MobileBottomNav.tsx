import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Truck, Users, DollarSign, FileText } from "lucide-react";

const TABS = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/camiones", label: "Equipos", icon: Truck },
  { to: "/choferes", label: "Choferes", icon: Users },
  { to: "/tarifas", label: "Tarifas", icon: DollarSign },
  { to: "/documentos", label: "Docs", icon: FileText },
] as const;

export function MobileBottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] md:hidden"
      aria-label="Navegación inferior"
    >
      {TABS.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(to + "/");
        return (
          <Link
            key={to}
            to={to}
            className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
            style={{ color: active ? "#2D7A45" : "hsl(var(--muted-foreground))" }}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
