/** Helpers server-only para la asignación manual de chofer en la ficha de operación. */

export type CandidatoTruck = { id: string; patente: string; tipo: string | null; match: boolean };
export type Candidato = {
  driver_id: string;
  nombre_completo: string;
  rut: string | null;
  clase_licencia: string | null;
  proveedor_id: string;
  proveedor_nombre: string | null;
  disp_desde: string | null;
  disp_hasta: string | null;
  disp_lugar: string | null;
  disp_destino: string | null;
  trucks: CandidatoTruck[];
};

export function normRut(v: string | null | undefined) {
  return (v ?? "").replace(/[^0-9kK]/g, "").toLowerCase();
}

export function overlaps(dispDesde: string, dispHasta: string | null, fecha: string) {
  const d = new Date(fecha).getTime();
  const from = new Date(dispDesde).getTime();
  const to = new Date(dispHasta ?? dispDesde).getTime();
  return d >= from && d <= to;
}

/** Compara el tipo requerido (nombre del catálogo) con el tipo del camión. */
export function tipoMatches(requerido: string | null, truckTipo: string | null) {
  if (!requerido || !truckTipo) return true;
  const a = requerido.toLowerCase().trim();
  const b = truckTipo.toLowerCase().trim();
  return a === b || a.includes(b) || b.includes(a);
}

type Row = Record<string, any>;

/**
 * Calcula los choferes sugeridos para una operación.
 * `tipoRequerido` viene de la cadena tipo_camion_id → tipo_camion_otro → texto legacy;
 * si es null no se bloquea a nadie: todos los camiones son candidatos neutros.
 */
export function construirCandidatos(args: {
  fecha: string | null;
  tipoRequerido: string | null;
  drivers: Row[];
  perfiles: Row[];
  disponibilidad: Row[];
  trucks: Row[];
  profiles: Row[];
}): Candidato[] {
  const { fecha, tipoRequerido, drivers, perfiles, disponibilidad, trucks, profiles } = args;

  const perfilPorKey = new Map<string, Row>();
  for (const p of perfiles) perfilPorKey.set(`${p["proveedor_id"]}|${normRut(p["rut"])}`, p);

  const nombreProveedor = new Map<string, string | null>();
  for (const p of profiles) nombreProveedor.set(p["id"] as string, (p["razon_social"] as string) ?? null);

  const disp = fecha
    ? disponibilidad.filter((d) => overlaps(d["fecha_desde"], d["fecha_hasta"] ?? null, fecha))
    : [];

  const out: Candidato[] = [];
  for (const d of drivers) {
    const key = `${d["user_id"]}|${normRut(d["rut"])}`;
    const perfil = perfilPorKey.get(key);
    if (!perfil) continue;

    const dispRow = disp.find((x) => x["driver_id"] === d["id"]) ?? null;
    if (!dispRow) continue;

    const proveedorTrucks = trucks.filter((t) => t["user_id"] === d["user_id"]);
    const base = dispRow["truck_id"]
      ? proveedorTrucks.filter((t) => t["id"] === dispRow["truck_id"])
      : proveedorTrucks;
    if (base.length === 0) continue;

    const conMatch = base.map((t) => ({
      id: t["id"] as string,
      patente: t["patente"] as string,
      tipo: (t["tipo"] as string) ?? null,
      match: tipoMatches(tipoRequerido, (t["tipo"] as string) ?? null),
    }));
    // Si hay tipo requerido y algún camión calza, se priorizan los que calzan;
    // si ninguno calza NO se bloquea: se muestran todos con badge neutro.
    const calzan = conMatch.filter((t) => t.match);
    const lista = tipoRequerido && calzan.length > 0 ? calzan : conMatch;

    out.push({
      driver_id: d["id"] as string,
      nombre_completo: d["nombre_completo"] as string,
      rut: (d["rut"] as string) ?? null,
      clase_licencia: (d["clase_licencia"] as string) ?? null,
      proveedor_id: perfil["proveedor_id"] as string,
      proveedor_nombre: nombreProveedor.get(perfil["proveedor_id"] as string) ?? null,
      disp_desde: (dispRow["fecha_desde"] as string) ?? null,
      disp_hasta: (dispRow["fecha_hasta"] as string) ?? null,
      disp_lugar: (dispRow["lugar_texto"] as string) ?? null,
      disp_destino: (dispRow["destino_texto"] as string) ?? null,
      trucks: lista,
    });
  }
  return out.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo));
}
