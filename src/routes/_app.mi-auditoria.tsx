import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/page-head";
import { useEffect, useState, useCallback } from "react";
import { History as HistoryIcon, RefreshCw, ArrowRightLeft, Plus, XCircle, MousePointerClick, Link as LinkIcon, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/mi-auditoria")({
  head: () =>
    pageHead(
      "/mi-auditoria",
      "Mi auditoría de acceso · Portal TN Chile",
      "Registro personal de ajustes automáticos a tu espacio activo por cambios de roles, para depurar problemas de acceso.",
    ),
  component: MiAuditoriaPage,
});

type Entry = {
  id: string;
  kind: "switched" | "lost-all" | "gained";
  from_space: string | null;
  to_space: string | null;
  added_roles: string[];
  removed_roles: string[];
  context: { path?: string | null } | null;
  created_at: string;
};

const spaceLabel = (s: string | null) =>
  s === "chofer" ? "Espacio Choferes" : s === "proveedor" ? "Portal Proveedor" : "—";

function KindBadge({ kind }: { kind: Entry["kind"] }) {
  if (kind === "switched")
    return (
      <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
        <ArrowRightLeft className="h-3 w-3 mr-1" /> Cambio automático
      </Badge>
    );
  if (kind === "gained")
    return (
      <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
        <Plus className="h-3 w-3 mr-1" /> Rol agregado
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-900 hover:bg-red-100">
      <XCircle className="h-3 w-3 mr-1" /> Sin acceso
    </Badge>
  );
}

function MiAuditoriaPage() {
  const [items, setItems] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("space_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as Entry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-[#2D7A45]" aria-hidden="true" />
          <h1 className="text-xl md:text-2xl font-semibold">Mi auditoría de acceso</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          aria-label="Actualizar registro"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Actualizar
        </Button>
      </header>

      <p className="text-sm text-muted-foreground">
        Este registro es privado: solo tú puedes verlo. Muestra cuándo el sistema
        ajustó automáticamente tu espacio activo por cambios en tus roles.
      </p>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Sin eventos registrados. Aparecerán aquí cuando cambien tus roles.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((e) => (
            <li key={e.id} className="border rounded-lg p-3 bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <KindBadge kind={e.kind} />
                <time className="text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("es-CL")}
                </time>
              </div>
              <div className="mt-2 text-sm">
                {e.kind === "switched" && (
                  <p>
                    Cambiado de <strong>{spaceLabel(e.from_space)}</strong> a{" "}
                    <strong>{spaceLabel(e.to_space)}</strong>.
                  </p>
                )}
                {e.kind === "gained" && (
                  <p>
                    Se agregaron nuevos roles mientras estabas en{" "}
                    <strong>{spaceLabel(e.from_space)}</strong>.
                  </p>
                )}
                {e.kind === "lost-all" && (
                  <p>
                    Perdiste acceso a los espacios de Proveedor y Chofer estando en{" "}
                    <strong>{spaceLabel(e.from_space)}</strong>.
                  </p>
                )}
                {(e.added_roles?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-emerald-800">
                    + {e.added_roles.join(", ")}
                  </p>
                )}
                {(e.removed_roles?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-red-800">
                    − {e.removed_roles.join(", ")}
                  </p>
                )}
                {e.context?.path && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ruta: <code>{e.context.path}</code>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
