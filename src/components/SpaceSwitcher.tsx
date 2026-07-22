import { useNavigate } from "@tanstack/react-router";
import { Truck, Briefcase } from "lucide-react";
import type { Space } from "@/hooks/useSpace";

type Props = {
  space: Space;
  setSpace: (s: Space) => void;
  className?: string;
  compact?: boolean;
};

export function SpaceSwitcher({ space, setSpace, className = "", compact = false }: Props) {
  const navigate = useNavigate();
  const go = (s: Space) => {
    if (s === space) return;
    setSpace(s);
    navigate({ to: s === "chofer" ? "/chofer" : "/dashboard" });
  };
  const base = "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors";
  return (
    <div
      role="group"
      aria-label="Cambiar espacio"
      className={`inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 p-0.5 ${className}`}
    >
      <button
        type="button"
        onClick={() => go("proveedor")}
        className={`${base} ${space === "proveedor" ? "bg-white text-primary" : "text-white/90 hover:bg-white/10"}`}
        aria-pressed={space === "proveedor"}
      >
        <Briefcase className="h-3.5 w-3.5" />
        {!compact && <span>Proveedor</span>}
      </button>
      <button
        type="button"
        onClick={() => go("chofer")}
        className={`${base} ${space === "chofer" ? "bg-white text-primary" : "text-white/90 hover:bg-white/10"}`}
        aria-pressed={space === "chofer"}
      >
        <Truck className="h-3.5 w-3.5" />
        {!compact && <span>Chofer</span>}
      </button>
    </div>
  );
}
