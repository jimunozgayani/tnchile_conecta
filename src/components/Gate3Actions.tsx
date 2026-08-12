import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldCheck, PauseCircle, X } from "lucide-react";
import { autorizarGate3, retenerGate3 } from "@/lib/gate3.functions";

const CONFIRM_MSG =
  "¿Confirmas pasar esta operación a Operaciones? Se generará la OC y la OV correspondientes.";

/**
 * Gate 3 — solo Admin o Líder de Cuenta autorizan el paso a Operaciones.
 * Se usa igual en las tarjetas del Kanban y en la ficha de cotización.
 */
export function Gate3Actions({
  id,
  size = "sm",
  onDone,
}: {
  id: string;
  size?: "xs" | "sm";
  onDone: (patch: Record<string, unknown>) => void;
}) {
  const autorizar = useServerFn(autorizarGate3);
  const retener = useServerFn(retenerGate3);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [comentario, setComentario] = useState("");

  const txt = size === "xs" ? "text-[10px]" : "text-xs";
  const pad = size === "xs" ? "px-2 py-1" : "px-3 py-2";

  const onAutorizar = async () => {
    if (!window.confirm(CONFIRM_MSG)) return;
    setBusy(true);
    try {
      const op = await autorizar({ data: { id } });
      onDone({ gate3_autorizado_at: new Date().toISOString() });
      toast.success(
        `Autorizado. Operación N° ${op.numero_operacion} creada. OC y OV se generarán próximamente (funcionalidad en desarrollo — ver Tanda 4).`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo autorizar el paso a Operaciones");
    } finally {
      setBusy(false);
    }
  };

  const onRetener = async () => {
    const c = comentario.trim();
    if (c.length < 10) {
      toast.error("El comentario es obligatorio (mínimo 10 caracteres).");
      return;
    }
    setBusy(true);
    try {
      const res = await retener({ data: { id, comentario: c } });
      onDone({ estado: res.estado });
      toast.success("Retenida. Volvió a Aceptada para revisión.");
      setModal(false);
      setComentario("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo retener la cotización");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-stop className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onAutorizar()}
        className={`inline-flex items-center gap-1.5 rounded-md bg-primary ${pad} ${txt} font-semibold text-primary-foreground disabled:opacity-60`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Autorizar paso a Operaciones
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setModal(true)}
        className={`inline-flex items-center gap-1.5 rounded-md border ${pad} ${txt} font-medium hover:bg-muted disabled:opacity-60`}
      >
        <PauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Retener — pedir revisión
      </button>

      {modal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-lg border bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-bold">Retener — pedir revisión</h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setModal(false)}
                className="rounded p-1 hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <label className="block text-xs font-medium" htmlFor={`gate3-com-${id}`}>
                Comentario para el equipo comercial (obligatorio)
              </label>
              <textarea
                id={`gate3-com-${id}`}
                rows={4}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Indica qué debe revisarse antes de pasar a Operaciones…"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="rounded-md border px-3 py-2 text-xs hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRetener()}
                  className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                >
                  {busy ? "Guardando…" : "Retener"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
