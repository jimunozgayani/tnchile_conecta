import { obtenerAsignacionPDF } from "@/lib/asignacion-pdf.server";
const id = "4860edc1-568d-46a6-9edd-772fdcdfe45f"; // Operación N° 9
const a = await obtenerAsignacionPDF(id);
console.log("1er pedido -> regenerado:", a.regenerado, a.storagePath);
const b = await obtenerAsignacionPDF(id);
console.log("2do pedido (cache) -> regenerado:", b.regenerado);
const res = await fetch(a.url);
const buf = new Uint8Array(await res.arrayBuffer());
console.log("descarga por URL firmada:", res.status, buf.length, "bytes");
await Bun.write("/tmp/asig/real.pdf", buf);
