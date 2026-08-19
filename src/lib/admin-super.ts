/** Tipos y etiquetas compartidos del panel de Gestión total (client-safe). */
export type AdminEntidad =
  | "usuario"
  | "proveedor"
  | "cliente"
  | "chofer"
  | "carga"
  | "operacion";

export type AdminFila = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  detalle: string | null;
  eliminado: boolean;
  extra: Record<string, string | number | boolean | null>;
};

export type StaffOpcion = { id: string; email: string; roles: string[] };

export const ENTIDAD_LABEL: Record<AdminEntidad, string> = {
  usuario: "Usuarios",
  proveedor: "Proveedores",
  cliente: "Clientes y contactos",
  chofer: "Choferes",
  carga: "Cargas (cotizaciones)",
  operacion: "Operaciones",
};
