import { renderAsignacion } from "./src/lib/pdf/asignacion-pdf.server";
import { writeFileSync } from "node:fs";
const vacio = {
  numero_operacion: 12, fecha: new Date().toISOString(),
  cliente_nombre: null, cliente_empresa: null, cliente_telefono: null, cliente_email: null,
  origen: "Valparaíso", destino: null, tipo_camion: null, descripcion_carga: null, peso_kg: null,
  chofer_nombre: null, chofer_rut: null, chofer_celular: null,
  patente_principal: null, patente_secundaria: null,
  fecha_carga: null, carga_hora_desde: null, carga_hora_hasta: null,
  descarga_fecha: null, descarga_hora_desde: null, descarga_hora_hasta: null, descarga_notas: null,
};
writeFileSync("/tmp/asig/vacio.pdf", await renderAsignacion(vacio, true));
console.log("ok");
