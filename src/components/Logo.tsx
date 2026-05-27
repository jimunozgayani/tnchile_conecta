import markUrl from "@/assets/tn-chile-mark.png";
import fullUrl from "@/assets/tn-chile-full.png";

type Props = {
  variant?: "mark" | "with-text" | "full";
  className?: string;
  textClassName?: string;
  showTagline?: boolean;
};

export function Logo({ variant = "with-text", className = "", textClassName = "", showTagline = true }: Props) {
  if (variant === "full") {
    return <img src={fullUrl} alt="TN Chile — La logística la hacemos juntos" className={className || "h-16 w-auto"} />;
  }
  if (variant === "mark") {
    return <img src={markUrl} alt="TN Chile" className={className || "h-10 w-10"} />;
  }
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img src={markUrl} alt="TN Chile" className="h-10 w-10 shrink-0" />
      <div className="flex flex-col leading-none">
        <span className={`text-lg font-bold tracking-tight ${textClassName}`}>TN CHILE</span>
        {showTagline && (
          <span className="mt-0.5 text-[10px] opacity-80">Portal de Proveedores</span>
        )}
      </div>
    </div>
  );
}
