import { Document, Page, View, Text } from "@react-pdf/renderer";
import { ordenStyles as s, fmtFechaLarga, pagoLabel } from "./empresa";
import {
  Condiciones,
  DatosFacturacion,
  EmisorBlock,
  Fila,
  ItemsTable,
  OrdenFooter,
  OrdenHeader,
  Totales,
} from "./orden-partes";

export type OrdenVentaData = {
  folio: string;
  fecha: string | null;
  numero_operacion: number | null;
  cliente_nombre: string | null;
  cliente_empresa: string | null;
  cliente_rut: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  tipo_pago: string | null;
  origen: string | null;
  destino: string | null;
  tipo_camion: string | null;
  precio_clp: number | null;
  descripcion_carga: string | null;
};

/** Orden de venta al cliente. Se renderiza en el servidor (renderToBuffer). */
export function OrdenVentaPDF({
  data,
  conLogo = true,
}: {
  data: OrdenVentaData;
  conLogo?: boolean;
}) {
  const d = data;
  const ruta = `${d.origen ?? "Origen no especificado"} - ${d.destino ?? "Destino no especificado"}`;
  const neto = Math.round(d.precio_clp ?? 0);
  const descripcion = [
    "Servicio de transporte de carga",
    d.tipo_camion ? `(${d.tipo_camion})` : null,
    `— ${ruta}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Document title={`Orden de venta ${d.folio}`} author="TN Chile">
      <Page size="A4" style={s.page}>
        <OrdenHeader
          titulo="ORDEN DE VENTA"
          folio={d.folio}
          fecha={fmtFechaLarga(d.fecha)}
          numeroOperacion={d.numero_operacion}
          conLogo={conLogo}
        />

        <View style={s.cols}>
          <EmisorBlock titulo="DE" />
          <View style={s.col}>
            <Text style={s.seccionTitulo}>CLIENTE</Text>
            <Fila etiqueta="Nombre:" valor={d.cliente_nombre ?? "No especificado"} />
            <Fila etiqueta="Empresa:" valor={d.cliente_empresa ?? "No especificada"} />
            <Fila etiqueta="RUT:" valor={d.cliente_rut ?? "No especificado"} />
            <Fila etiqueta="Email:" valor={d.cliente_email ?? "No especificado"} />
            <Fila etiqueta="Teléfono:" valor={d.cliente_telefono ?? "No especificado"} />
            <Fila etiqueta="Forma pago:" valor={pagoLabel(d.tipo_pago)} />
          </View>
        </View>

        <Text style={s.tituloServicio}>{ruta}</Text>
        <Text style={s.rutaLinea}>Retiro en: {d.origen ?? "No especificado"}</Text>
        <Text style={s.rutaLinea}>Entrega en: {d.destino ?? "No especificado"}</Text>
        {d.descripcion_carga ? (
          <Text style={s.rutaLinea}>Carga: {d.descripcion_carga}</Text>
        ) : null}

        <ItemsTable descripcion={descripcion} monto={neto} />
        <Totales neto={neto} />
        <Condiciones tipoPago={pagoLabel(d.tipo_pago)} folio={d.folio} documento="orden de venta" />
        <DatosFacturacion />
        <OrdenFooter documento="Orden de venta" />
      </Page>
    </Document>
  );
}
