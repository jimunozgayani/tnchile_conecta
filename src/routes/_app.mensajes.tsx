import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState } from "react";
import { MessageSquare, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/mensajes")({
  head: () => pageHead("/mensajes", "Mensajes · Portal TN Chile", "Bandeja de mensajes con el equipo de TN Chile: comunicación directa entre administración, operaciones, proveedores y choferes."),
  component: MensajesPage,
});

type Mensaje = {
  id: string;
  asunto: string;
  contenido: string;
  leido: boolean;
  created_at: string;
  de_usuario_id: string;
};

function MensajesPage() {
  const [items, setItems] = useState<Mensaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("mensajes")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data ?? []) as Mensaje[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = (supabase as any)
      .channel("mensajes-ch")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  const handleOpen = async (m: Mensaje) => {
    setOpenId((cur) => (cur === m.id ? null : m.id));
    if (!m.leido) {
      await (supabase as any).from("mensajes").update({ leido: true }).eq("id", m.id);
      setItems((prev) => prev.map((x) => (x.id === m.id ? { ...x, leido: true } : x)));
    }
  };

  const markAllRead = async () => {
    const ids = items.filter((m) => !m.leido).map((m) => m.id);
    if (ids.length === 0) return;
    await (supabase as any).from("mensajes").update({ leido: true }).in("id", ids);
    setItems((prev) => prev.map((m) => ({ ...m, leido: true })));
  };

  const unread = items.filter((m) => !m.leido).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <MessageSquare className="h-7 w-7 text-primary" /> Mensajes
          </h1>
          <p className="text-muted-foreground">
            {unread > 0 ? `Tienes ${unread} mensaje${unread === 1 ? "" : "s"} sin leer.` : "Todos los mensajes están al día."}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted">
            <CheckCheck className="h-4 w-4" /> Marcar todos como leídos
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando mensajes...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center shadow-sm">
          <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium">Aún no tienes mensajes</p>
          <p className="text-sm text-muted-foreground">TN Chile te avisará por aquí cuando tenga novedades.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((m) => {
            const isOpen = openId === m.id;
            return (
              <li key={m.id}
                className={`overflow-hidden rounded-lg border bg-card shadow-sm transition ${!m.leido ? "border-l-4 border-l-primary" : ""}`}>
                <button onClick={() => handleOpen(m)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${!m.leido ? "font-semibold" : "font-medium"}`}>{m.asunto}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      TN Chile · {new Date(m.created_at).toLocaleString("es-CL")}
                    </p>
                  </div>
                  {!m.leido && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Nuevo
                    </span>
                  )}
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
                    {m.contenido}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
