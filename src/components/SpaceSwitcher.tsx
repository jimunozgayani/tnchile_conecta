import { useNavigate } from "@tanstack/react-router";
import { Truck, Briefcase, Check } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import type { Space } from "@/hooks/useSpace";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  space: Space;
  setSpace: (s: Space) => Promise<boolean> | boolean | void;
  className?: string;
  compact?: boolean;
};

const SPACES: { value: Space; label: string; fullLabel: string; Icon: typeof Briefcase }[] = [
  { value: "proveedor", label: "Proveedor", fullLabel: "Portal Proveedor", Icon: Briefcase },
  { value: "chofer", label: "Chofer", fullLabel: "Espacio Choferes", Icon: Truck },
];

export function SpaceSwitcher({ space, setSpace, className = "", compact = false }: Props) {
  const navigate = useNavigate();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const go = async (s: Space) => {
    if (s === space) return;
    const ok = await Promise.resolve(setSpace(s));
    if (ok !== false) navigate({ to: s === "chofer" ? "/chofer" : "/dashboard" });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = SPACES.findIndex((s) => s.value === space);
    let nextIndex = currentIndex;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % SPACES.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + SPACES.length) % SPACES.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = SPACES.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const next = SPACES[nextIndex];
    refs.current[nextIndex]?.focus();
    go(next.value);
  };

  const base =
    "relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-primary";

  const activeLabel = SPACES.find((s) => s.value === space)?.fullLabel ?? "";

  return (
    <TooltipProvider delayDuration={200}>
      <div
        role="radiogroup"
        aria-label={`Cambiar espacio de trabajo. Espacio activo: ${activeLabel}`}
        onKeyDown={onKeyDown}
        className={`inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 p-0.5 ${className}`}
      >
        {SPACES.map((s, i) => {
          const selected = space === s.value;
          return (
            <Tooltip key={s.value}>
              <TooltipTrigger asChild>
                <button
                  ref={(el) => {
                    refs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={
                    selected
                      ? `${s.fullLabel} (espacio activo)`
                      : `Cambiar a ${s.fullLabel}`
                  }
                  tabIndex={selected ? 0 : -1}
                  onClick={() => go(s.value)}
                  className={`${base} ${
                    selected
                      ? "bg-white text-primary shadow-sm ring-1 ring-white"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {!compact && <span>{s.label}</span>}
                  {selected && (
                    <>
                      <span
                        className="ml-0.5 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Activo</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-snug">
                {selected ? (
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Espacio activo: {s.fullLabel}
                  </span>
                ) : (
                  <span>Cambiar a {s.fullLabel} sin cerrar sesión</span>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
