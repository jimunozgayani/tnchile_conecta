import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, User, Truck, Users, DollarSign, FileText, LogOut, Menu, X, ShieldCheck, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "./Logo";
import markUrl from "@/assets/tn-chile-mark.png";
import { SessionExpiryWarning } from "./SessionExpiryWarning";
import { NotificationBell } from "./NotificationBell";

const NAV = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/perfil", label: "Perfil", icon: User },
  { to: "/camiones", label: "Camiones", icon: Truck },
  { to: "/choferes", label: "Choferes", icon: Users },
  { to: "/tarifas", label: "Tarifas", icon: DollarSign },
  { to: "/documentos", label: "Documentos", icon: FileText },
  { to: "/mensajes", label: "Mensajes", icon: MessageSquare },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdmin((data ?? []).some((r: any) => r.role === "admin"));
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
          {NAV.map(({ to, label, icon: Icon }) => {
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
          {isAdmin && (
            <Link to="/admin" onClick={() => setOpen(false)}
              className={`mt-3 flex items-center gap-3 rounded-md border border-sidebar-border px-3 py-2 text-sm font-medium transition-colors ${
                location.pathname.startsWith("/admin") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "hover:bg-sidebar-accent"
              }`}>
              <ShieldCheck className="h-4 w-4" />
              Administración
            </Link>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
              <img src={markUrl} alt="TN Chile" className="h-9 w-9" />
            </div>
            <span className="text-lg font-bold tracking-tight">TN CHILE</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-xs italic opacity-90 md:block">La logística la hacemos juntos.</div>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
      <SessionExpiryWarning />
    </div>
  );
}
