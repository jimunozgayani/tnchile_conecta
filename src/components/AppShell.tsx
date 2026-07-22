import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, User, Truck, Users, DollarSign, FileText, LogOut, Menu, X, ShieldCheck, MessageSquare, Briefcase, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import markUrl from "@/assets/tn-chile-mark.png";
import { SessionExpiryWarning } from "./SessionExpiryWarning";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { CriticalAlertsListener } from "./CriticalAlertsListener";
import { MobileBottomNav } from "./MobileBottomNav";
import { InstallPrompt } from "./InstallPrompt";
import { Footer } from "./Footer";
import { useSpace } from "@/hooks/useSpace";
import { SpaceSwitcher } from "./SpaceSwitcher";
import { SpaceChangeBanner } from "./SpaceChangeBanner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const NAV = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/perfil", label: "Perfil", icon: User },
  { to: "/camiones", label: "Camiones", icon: Truck },
  { to: "/choferes", label: "Choferes", icon: Users },
  { to: "/tarifas", label: "Tarifas", icon: DollarSign },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/mensajes", label: "Mensajes", icon: MessageSquare },
  { to: "/mi-auditoria", label: "Mi auditoría", icon: HistoryIcon },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [isCliente, setIsCliente] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const { space, setSpace, canSwitch, roles, autoChange, dismissAutoChange } = useSpace();
  const isChofer = roles.includes("chofer");
  const isProveedor = roles.includes("proveedor");
  // Active view: if switcher applies, follow `space`; otherwise fall back to role
  const view: "admin" | "cliente" | "chofer" | "proveedor" =
    isAdmin ? "admin"
    : isCliente ? "cliente"
    : canSwitch ? (space === "chofer" ? "chofer" : "proveedor")
    : isChofer ? "chofer"
    : "proveedor";
  const showChoferNav = view === "chofer";
  const showProveedorNav = view === "proveedor";
  const showClienteNav = view === "cliente";

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const rs = (data ?? []).map((r: any) => r.role);
      setIsAdmin(rs.includes("admin"));
      setIsCliente(rs.includes("cliente"));
    })();
  }, []);

  useEffect(() => {
    const load = async () => {
      const { count } = await (supabase as any)
        .from("mensajes").select("id", { count: "exact", head: true }).eq("leido", false);
      setUnreadMsgs(count ?? 0);
    };
    load();
    const ch = (supabase as any)
      .channel("mensajes-shell")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [location.pathname]);

  const logout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };


  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-sidebar text-sidebar-foreground transition-transform md:relative md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          <Logo variant="with-text" textClassName="text-sidebar-foreground" />
          <button className="md:hidden" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        </div>
        <nav className="space-y-1 p-3">
          {showClienteNav && (
            <Link to="/cliente" onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname.startsWith("/cliente") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
              }`}>
              <User className="h-4 w-4" />
              Mi portal
            </Link>
          )}
          {showChoferNav && (
            <>
              <Link to="/chofer" onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname === "/chofer" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}>
                <Truck className="h-4 w-4" />
                Mi portal
              </Link>
              <Link to="/mis-viajes" onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname.startsWith("/mis-viajes") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}>
                <Briefcase className="h-4 w-4" />
                Mis viajes
              </Link>
              <Link to="/mi-disponibilidad-chofer" onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname.startsWith("/mi-disponibilidad-chofer") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}>
                <Truck className="h-4 w-4" />
                Mi disponibilidad
              </Link>
            </>
          )}

          {showProveedorNav && NAV.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/dashboard" && location.pathname.startsWith(to));
            const showBadge = to === "/mensajes" && unreadMsgs > 0;
            return (
              <Link key={to} to={to} onClick={() => setOpen(false)}
                className={`flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}>
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                {showBadge && (
                  <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground">
                    {unreadMsgs}
                  </span>
                )}
              </Link>
            );
          })}
          {showProveedorNav && (
            <>
              <Link to="/mi-disponibilidad" onClick={() => setOpen(false)}
                className={`mt-3 flex items-center gap-3 rounded-md border border-sidebar-border px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname === "/mi-disponibilidad" ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}>
                <Truck className="h-4 w-4" />
                Mi disponibilidad
              </Link>
              <Link to="/disponibilidad-choferes" onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md border border-sidebar-border px-3 py-2 text-sm font-medium transition-colors ${
                  location.pathname.startsWith("/disponibilidad-choferes") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                }`}>
                <Users className="h-4 w-4" />
                Disponibilidad choferes
              </Link>
            </>
          )}
          {isAdmin && (
            <>


              <div className="mt-4 border-t border-sidebar-border pt-3">
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                  Equipo TN Chile
                </p>
                <Link to="/admin" onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname.startsWith("/admin") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                  }`}>
                  <ShieldCheck className="h-4 w-4" />
                  Administración
                </Link>
                <Link to="/admin-choferes" onClick={() => setOpen(false)}
                  className={`mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname.startsWith("/admin-choferes") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                  }`}>
                  <ShieldCheck className="h-4 w-4" />
                  Invitar choferes
                </Link>
                <Link to="/operaciones" onClick={() => setOpen(false)}
                  className={`mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname.startsWith("/operaciones") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
                  }`}>
                  <Briefcase className="h-4 w-4" />
                  Operaciones
                </Link>
              </div>
            </>
          )}

        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-sidebar-border p-3">
          <p className="px-3 py-2 text-xs italic text-sidebar-foreground/70">
            "La logística la hacemos juntos."
          </p>
          <button onClick={logout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-primary-dark bg-primary px-4 text-primary-foreground md:px-8">
          <button className="md:hidden" onClick={() => setOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="flex items-center gap-3">
            <img src={markUrl} alt="TN Chile" className="h-10 w-10" />
            <span className="text-lg font-bold tracking-tight">TN CHILE</span>
          </div>
          <div className="flex items-center gap-3">
            {(() => {
              const label =
                view === "admin" ? "Administración"
                : view === "cliente" ? "Portal Cliente"
                : view === "chofer" ? "Espacio Choferes"
                : "Portal Proveedor";
              const tooltip =
                view === "admin"
                  ? "Estás en el panel de administración de TN Chile."
                  : view === "cliente"
                  ? "Estás en el portal de clientes."
                  : canSwitch
                  ? "Tienes acceso a ambos espacios. Usa el selector para cambiar sin cerrar sesión."
                  : "Este es el espacio asignado a tu cuenta.";
              return (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        {userEmail && (
                          <span className="hidden max-w-[160px] truncate text-xs font-medium text-primary-foreground/90 sm:inline">
                            {userEmail}
                          </span>
                        )}
                        <span
                          className="inline-flex cursor-help items-center rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                          aria-label={`Espacio activo: ${label}`}
                          data-testid="active-space-badge"
                        >
                          {label}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" align="end" className="max-w-[240px] text-xs leading-snug">
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })()}
            {(isChofer || isProveedor) && !isAdmin && !isCliente && (
              <SpaceSwitcher
                space={space}
                setSpace={setSpace}
                roles={roles}
                compact
                className="hidden sm:inline-flex"
              />
            )}
            <div className="hidden text-xs italic opacity-90 lg:block">La logística la hacemos juntos.</div>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <SpaceChangeBanner change={autoChange} onDismiss={dismissAutoChange} />
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">{children}</main>
        <Footer />
      </div>
      <SessionExpiryWarning />
      <MobileBottomNav
        space={canSwitch ? space : undefined}
        setSpace={canSwitch ? setSpace : undefined}
      />
      <InstallPrompt />
    </div>
  );
}

