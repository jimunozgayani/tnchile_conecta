import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { AdminEntidad } from "@/lib/admin-super";
import { eliminarAdminEntidad } from "@/lib/admin-super.functions";

/**
 * Acciones plenipotenciarias de administrador embebidas en las pantallas
 * existentes (eliminar con borrado lógico o definitivo). Solo se renderiza
 * cuando el usuario tiene rol admin; el servidor vuelve a validarlo.
 */
export function AdminAcciones({
  tipo,
  id,
  nombre,
  esAdmin,
  onDone,
  compact = false,
}: {
  tipo: AdminEntidad;
  id: string;
  nombre: string;
  esAdmin: boolean;
  onDone?: () => void;
  compact?: boolean;
}) {
  const eliminar = useServerFn(eliminarAdminEntidad);
  const [busy, setBusy] = useState(false);

  if (!esAdmin) return null;

  async function borrar(modo: "logico" | "definitivo") {
    const aviso =
      modo === "definitivo"
        ? `Vas a BORRAR DEFINITIVAMENTE "${nombre}". No se puede deshacer. ¿Continuar?`
        : `¿Eliminar "${nombre}"? Quedará oculto y podrás restaurarlo desde Gestión total.`;
    if (!confirm(aviso)) return;
    setBusy(true);
    try {
      const r = await eliminar({ data: { tipo, id, modo } });
      toast.success(r.mensaje);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-2"}`}>
      <button
        type="button"
        onClick={() => void borrar("logico")}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar
      </button>
      <button
        type="button"
        onClick={() => void borrar("definitivo")}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" /> Borrar definitivo
      </button>
    </div>
  );
}
