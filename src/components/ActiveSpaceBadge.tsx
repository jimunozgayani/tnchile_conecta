import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ActiveSpaceView = "admin" | "cliente" | "chofer" | "proveedor";

type Props = {
  view: ActiveSpaceView;
  canSwitch?: boolean;
  userEmail?: string | null;
};

const LABELS: Record<ActiveSpaceView, string> = {
  admin: "Administración",
  cliente: "Portal Cliente",
  chofer: "Espacio Choferes",
  proveedor: "Portal Proveedor",
};

function tooltipFor(view: ActiveSpaceView, canSwitch: boolean): string {
  if (view === "admin") return "Estás en el panel de administración de TN Chile.";
  if (view === "cliente") return "Estás en el portal de clientes.";
  if (canSwitch)
    return "Tienes acceso a ambos espacios. Usa el selector para cambiar sin cerrar sesión.";
  return "Este es el espacio asignado a tu cuenta.";
}

export function ActiveSpaceBadge({ view, canSwitch = false, userEmail }: Props) {
  const label = LABELS[view];
  const tooltip = tooltipFor(view, canSwitch);
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
              role="status"
              aria-live="polite"
              tabIndex={0}
              className="inline-flex cursor-help items-center rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-primary"
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
}
