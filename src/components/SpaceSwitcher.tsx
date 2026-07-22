import { useNavigate } from "@tanstack/react-router";
import { Truck, Briefcase } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import type { Space } from "@/hooks/useSpace";

type Props = {
  space: Space;
  setSpace: (s: Space) => void;
  className?: string;
  compact?: boolean;
};

const SPACES: { value: Space; label: string; Icon: typeof Briefcase }[] = [
  { value: "proveedor", label: "Proveedor", Icon: Briefcase },
  { value: "chofer", label: "Chofer", Icon: Truck },
];

export function SpaceSwitcher({ space, setSpace, className = "", compact = false }: Props) {
  const navigate = useNavigate();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const go = (s: Space) => {
    if (s === space) return;
    setSpace(s);
    navigate({ to: s === "chofer" ? "/chofer" : "/dashboard" });
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
    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1 focus-visible:ring-offset-primary";

  return (
    <div
      role="radiogroup"
      aria-label="Cambiar espacio de trabajo"
      onKeyDown={onKeyDown}
      className={`inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 p-0.5 ${className}`}
    >
      {SPACES.map((s, i) => {
        const selected = space === s.value;
        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={compact ? s.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => go(s.value)}
            className={`${base} ${selected ? "bg-white text-primary" : "text-white/90 hover:bg-white/10"}`}
          >
            <s.Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {!compact && <span>{s.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
