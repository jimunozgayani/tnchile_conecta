import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Notif = {
  id: string;
  user_id: string;
  entity_tipo: string;
  entity_id: string;
  entity_name: string | null;
  doc_tipo: string;
  fecha_vencimiento: string;
  dias_restantes: number;
  umbral: number;
  severidad: "warning" | "critical";
  leida: boolean;
  created_at: string;
};

const ENTITY_LABEL: Record<string, string> = {
  truck: "Camión",
  driver: "Chofer",
  profile: "Proveedor",
};

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("notificaciones")
      .select("*")
      .order("severidad", { ascending: false })
      .order("dias_restantes", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as Notif[]);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setIsAdmin((roles ?? []).some((r: any) => r.role === "admin"));
      load();
    })();
    const ch = supabase
      .channel("notificaciones-ch")
      .on("postgres_changes", { event: "*", schema: "public", table: "notificaciones" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = items.filter((n) => !n.leida).length;

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.leida).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notificaciones").update({ leida: true }).in("id", ids);
    load();
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
        aria-label="Notificaciones"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-xl border bg-card text-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notificaciones</p>
              {isAdmin && <p className="text-[11px] text-muted-foreground">Vista admin · todos los proveedores</p>}
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <CheckCheck className="h-3.5 w-3.5" /> Marcar todas como leídas
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
              <ShieldCheck className="h-10 w-10 text-success" />
              <p className="text-sm font-medium">Todo en orden</p>
              <p className="text-xs text-muted-foreground">Sin alertas activas</p>
            </div>
          ) : (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {items.map((n) => {
                const critical = n.severidad === "critical";
                const text =
                  n.dias_restantes <= 0
                    ? `Vencido hace ${Math.abs(n.dias_restantes)} d`
                    : `${n.dias_restantes} d restantes`;
                return (
                  <li key={n.id} className={`flex items-start gap-3 px-4 py-3 text-sm ${n.leida ? "opacity-70" : ""}`}>
                    <span className="mt-0.5 text-base leading-none">{critical ? "🔴" : "⚠️"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {n.doc_tipo} · {ENTITY_LABEL[n.entity_tipo] ?? n.entity_tipo} {n.entity_name || ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence {n.fecha_vencimiento} · <span className={critical ? "font-semibold text-destructive" : "font-semibold text-warning-foreground"}>{text}</span>
                      </p>
                    </div>
                    {!n.leida && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
