import { useState } from "react";
import { Info, X, AlertTriangle, Sparkles } from "lucide-react";
import type { SpaceAutoChange } from "@/hooks/useSpace";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SPACE_LABEL: Record<string, string> = {
  proveedor: "Portal Proveedor",
  chofer: "Espacio Choferes",
};

const ROLE_LABEL: Record<string, string> = {
  proveedor: "Proveedor",
  chofer: "Chofer",
  admin: "Administrador",
  cliente: "Cliente",
};

function labelSpace(s: string | null) {
  return s ? SPACE_LABEL[s] ?? s : "—";
}
function labelRole(r: string) {
  return ROLE_LABEL[r] ?? r;
}

export function SpaceChangeBanner({
  change,
  onDismiss,
}: {
  change: SpaceAutoChange | null;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!change) return null;

  const isError = change.kind === "lost-all";
  const Icon = change.kind === "gained" ? Sparkles : isError ? AlertTriangle : Info;

  const headline =
    change.kind === "switched"
      ? `Cambiamos tu vista a ${labelSpace(change.to)} automáticamente`
      : change.kind === "lost-all"
      ? "Perdiste el acceso a los espacios de Proveedor y Chofer"
      : "Se actualizaron los roles de tu cuenta";

  const subline =
    change.kind === "switched"
      ? `Ya no tienes acceso a ${labelSpace(change.from)}. Tu sesión sigue activa.`
      : change.kind === "lost-all"
      ? "Contacta al administrador si crees que es un error."
      : "No cambiamos tu vista actual, pero ahora puedes acceder a nuevos espacios.";

  const tone = isError
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : change.kind === "gained"
    ? "border-primary/30 bg-primary/10 text-primary-dark"
    : "border-amber-300 bg-amber-50 text-amber-900";

  return (
    <>
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={`mx-4 mt-4 flex items-start gap-3 rounded-md border px-4 py-3 md:mx-8 ${tone}`}
      >
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{headline}</p>
          <p className="mt-0.5 text-xs opacity-90">{subline}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => setOpen(true)}
          >
            Ver detalles
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Cerrar aviso"
            className="rounded-md p-1 hover:bg-black/5"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Qué cambió en tu cuenta?</DialogTitle>
            <DialogDescription>
              Detectamos cambios en los roles asignados a tu usuario. Aquí el detalle:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vista activa</p>
              <p className="mt-1 font-medium">
                {labelSpace(change.from)} → {labelSpace(change.to)}
              </p>
            </div>

            {change.removedRoles.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                  Roles removidos
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {change.removedRoles.map((r) => (
                    <li key={r}>{labelRole(r)}</li>
                  ))}
                </ul>
              </div>
            )}

            {change.addedRoles.length > 0 && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-dark">
                  Roles agregados
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {change.addedRoles.map((r) => (
                    <li key={r}>{labelRole(r)}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              No es necesario cerrar sesión. Si crees que este cambio es un error, contacta al
              administrador.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                onDismiss();
              }}
            >
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
