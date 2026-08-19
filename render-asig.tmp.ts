import { renderAsignacion } from "./src/lib/pdf/asignacion-pdf.server";
import { writeFileSync } from "node:fs";

const buf = await renderAsignacion({
  numero_operacion: 11,
  fecha: new Date().toISOString(),
  cliente_nombre: "María José Fernández",
  cliente_empresa: "Constructora Andes Ltda.",
  cliente_telefono: "+56 9 8765 4321",
  cliente_email: "mjfernandez@andes.cl",
  origen: "Bodega Central, Pudahuel, Región Metropolitana",
  destino: "Faena Los Bronces, Colina",
  tipo_camion: "Camión rampla plana 3 ejes",
  descripcion_carga: "Estructura metálica prefabricada, 4 módulos con eslingas propias.",
  peso_kg: 18500,
  chofer_nombre: "Luis Alberto Cárdenas Muñoz",
  chofer_rut: "13.456.789-0",
  chofer_celular: "+56 9 1122 3344",
  patente_principal: "KXPT-45",
  patente_secundaria: "RM-8821",
  fecha_carga: "2026-08-21",
  carga_hora_desde: "08:30:00",
  carga_hora_hasta: "11:00:00",
  descarga_fecha: "2026-08-22",
  descarga_hora_desde: "07:00:00",
  descarga_hora_hasta: "09:30:00",
  descarga_notas: "Ingreso solo con credencial vigente y chaleco reflectante. Coordinar con portería 30 minutos antes; la descarga se realiza con grúa del cliente y no se permite maniobra propia dentro de la faena.",
}, false);
writeFileSync("/tmp/asig/asignacion.pdf", buf);
console.log("bytes", buf.length);
