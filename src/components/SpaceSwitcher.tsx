import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Truck, Briefcase, Check, Lock } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import type { Space } from "@/hooks/useSpace";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  space: Space;
  setSpace: (s: Space) => Promise<boolean> | boolean | void;
  className?: string;
  compact?: boolean;
  roles?: string[];
};

const SPACES: { value: Space; role: string; label: string; fullLabel: string; Icon: typeof Briefcase }[] = [
  { value: "proveedor", role: "proveedor", label: "Proveedor", fullLabel: "Portal Proveedor", Icon: Briefcase },
  { value: "chofer", role: "chofer", label: "Chofer", fullLabel: "Espacio Choferes", Icon: Truck },
];

// Query params that carry cross-space context worth keeping when the user
// switches views (tracking, referrers, deep-link hints, debug flags, and
// return_to/highlight cues). Space-scoped ids like ?tripId=, ?camionId=,
// ?asignacionId= are intentionally excluded — they belong to a single space
// and would 404 on the other side.
const CONTEXT_PARAM_KEYS = new Set<string>([
  "ref",
  "from",
  "source",
  "return_to",
  "returnTo",
  "redirect",
  "debug",
  "preview",
  "highlight",
  "lang",
  "locale",
  "theme",
]);
const CONTEXT_PARAM_PREFIXES = ["utm_", "mc_", "gclid", "fbclid"] as const;

function isContextParam(key: string): boolean {
  if (CONTEXT_PARAM_KEYS.has(key)) return true;
  const k = key.toLowerCase();
  return CONTEXT_PARAM_PREFIXES.some((p) => k === p || k.startsWith(p));
}

function pickContextParams(prev: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!prev) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined || v === null || v === "") continue;
    if (isContextParam(k)) out[k] = v;
  }
  return out;
}

export function SpaceSwitcher({ space, setSpace, className = "", compact = false, roles }: Props) {
  const navigate = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash ?? "" });
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const isEnabled = (s: (typeof SPACES)[number]) => !roles || roles.includes(s.role);

  const go = async (s: Space) => {
    if (s === space) return;
    const ok = await Promise.resolve(setSpace(s));
    if (ok !== false) {
      navigate({
        to: s === "chofer" ? "/chofer" : "/dashboard",
        // Preserve cross-space context (utm, ref, debug, return_to…) and hash
        // so deep-link intent survives the switch. Space-scoped ids are
        // intentionally dropped by pickContextParams.
        search: (prev: Record<string, unknown> | undefined) => pickContextParams(prev),
        hash: hash || undefined,
      });
    }
  };


  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabledIdx = SPACES.map((s, i) => (isEnabled(s) ? i : -1)).filter((i) => i >= 0);
    if (enabledIdx.length === 0) return;
    const currentIndex = SPACES.findIndex((s) => s.value === space);
    const pos = enabledIdx.indexOf(currentIndex);
    let nextIndex = currentIndex;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = enabledIdx[(Math.max(pos, 0) + 1) % enabledIdx.length];
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = enabledIdx[(Math.max(pos, 0) - 1 + enabledIdx.length) % enabledIdx.length];
        break;
      case "Home":
        nextIndex = enabledIdx[0];
        break;
      case "End":
        nextIndex = enabledIdx[enabledIdx.length - 1];
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
          const enabled = isEnabled(s);
          const disabledLabel = `${s.fullLabel} — no disponible para tu cuenta`;
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
                  aria-disabled={!enabled}
                  disabled={!enabled}
                  aria-label={
                    !enabled
                      ? disabledLabel
                      : selected
                      ? `${s.fullLabel} (espacio activo)`
                      : `Cambiar a ${s.fullLabel}`
                  }
                  tabIndex={selected && enabled ? 0 : -1}
                  onClick={() => enabled && go(s.value)}
                  className={`${base} ${
                    !enabled
                      ? "cursor-not-allowed text-white/40 opacity-60"
                      : selected
                      ? "bg-white text-primary shadow-sm ring-1 ring-white"
                      : "text-white/90 hover:bg-white/10"
                  }`}
                >
                  <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {!compact && <span>{s.label}</span>}
                  {!enabled && (
                    <>
                      <Lock className="ml-0.5 h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">No disponible</span>
                    </>
                  )}
                  {enabled && selected && (
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
              <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-snug">
                {!enabled ? (
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      No disponible
                    </span>
                    <span>
                      Tu cuenta no tiene el rol {s.label} asignado. Contacta al administrador si necesitas acceso a {s.fullLabel}.
                    </span>
                  </span>
                ) : selected ? (
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
