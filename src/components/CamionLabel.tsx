export type TruckLike = {
  id?: string;
  patente?: string | null;
  tipo?: string | null;
  tipo_camion?: { nombre?: string | null; requiere_acople?: boolean | null } | null;
  acoplado?: { patente?: string | null } | null;
} | null | undefined;

/**
 * Type-first vehicle label used across all availability screens:
 * the truck TYPE is the prominent label, patente(s) are secondary.
 * (The assignment screen intentionally does the opposite.)
 */
export function CamionLabel({
  truck,
  emptyLabel = "Sin camión asignado",
  className = "",
}: {
  truck: TruckLike;
  emptyLabel?: string;
  className?: string;
}) {
  if (!truck) {
    return <span className={`text-xs italic text-muted-foreground ${className}`}>{emptyLabel}</span>;
  }

  const tipo = truck.tipo_camion?.nombre ?? truck.tipo ?? "Tipo no definido";
  const patentes = [truck.patente, truck.tipo_camion?.requiere_acople ? truck.acoplado?.patente : null]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className={`leading-tight ${className}`}>
      <div className="text-sm font-bold text-foreground">{tipo}</div>
      {patentes && (
        <div className="text-[11px] font-normal text-muted-foreground">{patentes}</div>
      )}
      {truck.tipo_camion?.requiere_acople && !truck.acoplado?.patente && (
        <div className="text-[10px] text-amber-700">Sin unidad acoplada</div>
      )}
    </div>
  );
}
