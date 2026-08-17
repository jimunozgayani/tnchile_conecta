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

export type OrdenCompraData = {
  folio: string;
  fecha: string | null;
  numero_operacion: number | null;
  proveedor_nombre: string | null;
  proveedor_rut: string | null;
  proveedor_email: string | null;
  proveedor_telefono: string | null;
  proveedor_direccion: string | null;
  tipo_pago: string | null;
  origen: string | null;
  destino: string | null;
  tipo_camion: string | null;
  chofer_nombre: string | null;
  chofer_rut: string | null;
  patente_principal: string | null;
  patente_secundaria: string | null;
  costo_clp: number | null;
  descripcion_carga: string | null;
};

/** Orden de compra al proveedor. Se renderiza en el servidor (renderToBuffer). */
export function OrdenCompraPDF({
  data,
  conLogo = true,
}: {
  data: OrdenCompraData;
  conLogo?: boolean;
}) {
  const d = data;
  const ruta = `${d.origen ?? "Origen no especificado"} - ${d.destino ?? "Destino no especificado"}`;
  const neto = Math.round(d.costo_clp ?? 0);
  const descripcion = [
    "Servicio de transporte de carga",
    d.tipo_camion ? `(${d.tipo_camion})` : null,
    `— ${ruta}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Document title={`Orden de compra ${d.folio}`} author="TN Chile">
      <Page size="A4" style={s.page}>
        <OrdenHeader
          titulo="ORDEN DE COMPRA"
          folio={d.folio}
          fecha={fmtFechaLarga(d.fecha)}
          numeroOperacion={d.numero_operacion}
          conLogo={conLogo}
        />

        <View style={s.cols}>
          <EmisorBlock titulo="DE" />
          <View style={s.col}>
            <Text style={s.seccionTitulo}>PROVEEDOR</Text>
            <Fila etiqueta="Nombre:" valor={d.proveedor_nombre ?? "No especificado"} />
            <Fila etiqueta="RUT:" valor={d.proveedor_rut ?? "No especificado"} />
            <Fila etiqueta="Dirección:" valor={d.proveedor_direccion ?? "No especificada"} />
            <Fila etiqueta="Email:" valor={d.proveedor_email ?? "No especificado"} />
            <Fila etiqueta="Teléfono:" valor={d.proveedor_telefono ?? "No especificado"} />
            <Fila etiqueta="Forma pago:" valor={pagoLabel(d.tipo_pago)} />
          </View>
        </View>

        <Text style={s.tituloServicio}>{ruta}</Text>
        <Text style={s.rutaLinea}>Retiro en: {d.origen ?? "No especificado"}</Text>
        <Text style={s.rutaLinea}>Entrega en: {d.destino ?? "No especificado"}</Text>
        {d.descripcion_carga ? (
          <Text style={s.rutaLinea}>Carga: {d.descripcion_carga}</Text>
        ) : null}

        <View style={s.bloqueChofer}>
          <Text>
            Chofer asignado: {d.chofer_nombre ?? "Por confirmar"}
            {d.chofer_rut ? ` — RUT: ${d.chofer_rut}` : ""}
            {d.patente_principal ? ` — Patente: ${d.patente_principal}` : ""}
          </Text>
          {d.patente_secundaria ? (
            <Text>+ Patente rampla/carro: {d.patente_secundaria}</Text>
          ) : null}
        </View>

        <ItemsTable descripcion={descripcion} monto={neto} />
        <Totales neto={neto} />
        <Condiciones tipoPago={pagoLabel(d.tipo_pago)} folio={d.folio} documento="orden de compra" />
        <DatosFacturacion />
        <OrdenFooter documento="Orden de compra" />
      </Page>
    </Document>
  );
}
