import { View, Text, Image } from "@react-pdf/renderer";
import {
  EMPRESA,
  LOGO_URL_ABS,
  fmtCLP,
  ordenStyles as s,
} from "./empresa";

export function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.linea}>
      <Text style={s.etiqueta}>{etiqueta}</Text>
      <Text style={s.valor}>{valor}</Text>
    </View>
  );
}

/** Encabezado con logo (omitible si la imagen no se puede cargar en el runtime). */
export function OrdenHeader({
  titulo,
  folio,
  fecha,
  numeroOperacion,
  conLogo = true,
}: {
  titulo: string;
  folio: string;
  fecha: string;
  numeroOperacion: number | null;
  conLogo?: boolean;
}) {
  return (
    <>
      <View style={s.headerRow}>
        <View style={s.marcaBloque}>
          {conLogo ? <Image src={LOGO_URL_ABS} style={s.logo} /> : null}
          <View>
            <Text style={s.tagline}>La logística la hacemos juntos.</Text>
          </View>
        </View>
        <View>
          <Text style={s.docTitulo}>{titulo}</Text>
          <Text style={s.docMeta}>N° {folio}</Text>
          <Text style={s.docMeta}>Fecha: {fecha}</Text>
          {numeroOperacion != null && (
            <Text style={s.docMeta}>Operación N° {numeroOperacion}</Text>
          )}
        </View>
      </View>
      <View style={s.divider} />
    </>
  );
}

export function EmisorBlock({ titulo = "DE" }: { titulo?: string }) {
  return (
    <View style={s.col}>
      <Text style={s.seccionTitulo}>{titulo}</Text>
      <Fila etiqueta="Razón social:" valor={EMPRESA.razon_social} />
      <Fila etiqueta="RUT:" valor={EMPRESA.rut} />
      <Fila etiqueta="Giro:" valor={EMPRESA.giro} />
      <Fila etiqueta="Dirección:" valor={EMPRESA.direccion} />
      <Fila etiqueta="Email:" valor={EMPRESA.email} />
    </View>
  );
}

export function ItemsTable({
  descripcion,
  monto,
}: {
  descripcion: string;
  monto: number;
}) {
  return (
    <View style={s.tabla}>
      <View style={s.tablaHeader}>
        <Text style={[s.th, s.cDesc]}>Descripción</Text>
        <Text style={[s.th, s.cCant]}>Cant.</Text>
        <Text style={[s.th, s.cUnit]}>Precio unitario</Text>
        <Text style={[s.th, s.cTotal]}>Total neto</Text>
      </View>
      <View style={s.tr}>
        <Text style={[s.td, s.cDesc]}>{descripcion}</Text>
        <Text style={[s.td, s.cCant]}>1</Text>
        <Text style={[s.td, s.cUnit]}>{fmtCLP(monto)}</Text>
        <Text style={[s.td, s.cTotal]}>{fmtCLP(monto)}</Text>
      </View>
    </View>
  );
}

export function Totales({ neto }: { neto: number }) {
  const iva = Math.round(neto * 0.19);
  return (
    <View style={s.totales}>
      <View style={s.totalLinea}>
        <Text>Neto</Text>
        <Text>{fmtCLP(neto)}</Text>
      </View>
      <View style={s.totalLinea}>
        <Text>IVA 19%</Text>
        <Text>{fmtCLP(iva)}</Text>
      </View>
      <View style={s.totalFinal}>
        <Text style={s.totalFinalTexto}>TOTAL</Text>
        <Text style={s.totalFinalTexto}>{fmtCLP(neto + iva)}</Text>
      </View>
    </View>
  );
}

export function Condiciones({
  tipoPago,
  folio,
  documento,
}: {
  tipoPago: string;
  folio: string;
  documento: "orden de compra" | "orden de venta";
}) {
  return (
    <View style={s.seccion}>
      <Text style={s.seccionTitulo}>CONDICIONES</Text>
      <Fila etiqueta="Forma de pago:" valor={tipoPago} />
      <Fila etiqueta="Vigencia:" valor="30 días desde la fecha de emisión" />
      <View style={s.nota}>
        <Text>
          Se sugiere indicar el N° de esta {documento} {folio} al realizar el pago, para facilitar
          la conciliación.
        </Text>
      </View>
    </View>
  );
}

export function DatosFacturacion() {
  return (
    <View style={s.seccion}>
      <Text style={s.seccionTitulo}>DATOS DE FACTURACIÓN</Text>
      <View style={s.cols}>
        <View style={s.col}>
          <Fila etiqueta="Razón social:" valor={EMPRESA.razon_social} />
          <Fila etiqueta="RUT:" valor={EMPRESA.rut} />
          <Fila etiqueta="Giro:" valor={EMPRESA.giro} />
          <Fila etiqueta="Dirección:" valor={EMPRESA.direccion} />
        </View>
        <View style={s.col}>
          <Fila etiqueta="Banco:" valor={EMPRESA.banco} />
          <Fila etiqueta="Tipo cuenta:" valor={EMPRESA.tipo_cuenta} />
          <Fila etiqueta="N° cuenta:" valor={EMPRESA.numero_cuenta} />
          <Fila etiqueta="Email:" valor={EMPRESA.email} />
        </View>
      </View>
    </View>
  );
}

export function OrdenFooter({ documento }: { documento: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerTexto}>
        {documento} emitida por {EMPRESA.razon_social} (TN Chile). No constituye factura ni boleta
        electrónica.
      </Text>
      <Text
        style={s.footerTexto}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}
