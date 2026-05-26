import { Globe } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Globe className="h-5 w-5" />
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight">TN CHILE</span>
        <span className="text-[10px] text-muted-foreground">Portal de Proveedores</span>
      </div>
    </div>
  );
}
