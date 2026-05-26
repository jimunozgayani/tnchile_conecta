import { diasHasta, estadoVencimiento } from "@/lib/regions";

export function StatusBadge({ fecha, label }: { fecha: string | null | undefined; label?: string }) {
  const estado = estadoVencimiento(fecha);
  const dias = diasHasta(fecha);
  if (estado === "none") {
    return <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{label ?? "Sin fecha"}</span>;
  }
  const styles = {
    ok: "bg-success/15 text-success",
    warn: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/15 text-destructive",
  }[estado];
  const texto =
    dias! < 0 ? `Vencido hace ${Math.abs(dias!)} d` : `${dias} d restantes`;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label ? `${label}: ` : ""}{texto}
    </span>
  );
}
