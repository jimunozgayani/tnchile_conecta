import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";
  const label = isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            aria-label={label}
            aria-pressed={isDark}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 text-primary-foreground transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${className}`}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
