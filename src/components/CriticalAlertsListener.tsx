import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

// Non-intrusive push notifications for critical module events.
// Listens for realtime INSERTs on notificaciones (expiries/permits) and
// asignaciones (contracts) and surfaces them as sonner toasts. Deduped via
// sessionStorage so a refresh doesn't re-toast the same event.

const SEEN_KEY = "tn-critical-seen";

function seen(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function markSeen(id: string) {
  try {
    const s = seen();
    s.add(id);
    // cap
    const arr = Array.from(s).slice(-200);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch {}
}

const ENTITY_LABEL: Record<string, string> = {
  truck: "Camión",
  driver: "Chofer",
  profile: "Proveedor",
  poliza: "Póliza",
};

export function CriticalAlertsListener() {
  const navigate = useNavigate();
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    let userId: string | null = null;
    let driverIds: string[] = [];

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Preload driver ids linked to this auth user so we can filter
      // asignaciones aimed at them.
      const { data: dIds } = await supabase.rpc("chofer_driver_ids", { _uid: user.id });
      driverIds = ((dIds ?? []) as any[]).map((r) => r.chofer_driver_ids ?? r).filter(Boolean);
    })();

    const chNotif = supabase
      .channel("critical-notif")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          const n: any = payload.new;
          if (!n || !userId) return;
          if (n.user_id !== userId) return;
          if (n.severidad !== "critical") return;
          if (seen().has(n.id)) return;
          markSeen(n.id);
          const entity = ENTITY_LABEL[n.entity_tipo] ?? n.entity_tipo;
          const restante =
            n.dias_restantes <= 0
              ? `vencido hace ${Math.abs(n.dias_restantes)} d`
              : `vence en ${n.dias_restantes} d`;
          toast.warning(`${entity}: ${n.doc_tipo}`, {
            description: `${n.entity_name ?? ""} — ${restante}`,
            duration: 8000,
            action: {
              label: "Ver",
              onClick: () => navigate({ to: "/documentos" }),
            },
          });
        },
      )
      .subscribe();

    const chAsig = supabase
      .channel("critical-asig")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "asignaciones" },
        (payload) => {
          const a: any = payload.new;
          if (!a || !userId) return;
          const forMe =
            a.proveedor_id === userId || (a.chofer_id && driverIds.includes(a.chofer_id));
          if (!forMe) return;
          if (seen().has(`asig:${a.id}`)) return;
          markSeen(`asig:${a.id}`);
          toast.info("Nueva asignación de carga", {
            description: a.origen && a.destino ? `${a.origen} → ${a.destino}` : "Revisa los detalles del contrato.",
            duration: 8000,
            action: {
              label: "Ver",
              onClick: () => navigate({ to: "/mis-viajes" }),
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chNotif);
      supabase.removeChannel(chAsig);
    };
  }, [navigate]);

  return null;
}
