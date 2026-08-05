import { supabase } from "@/integrations/supabase/client";

const SELECT_COTIZACION =
  "id, contacto_id, contacto_nombre, contacto_telefono, contacto_email, origen, destinos, tipo_camion, modalidad, peso_kg, fecha_despacho, created_at, validez_hasta, precio_ofrecido_cliente_clp, lineas_servicio, tipo_pago, sobreestadia_horas_libres, sobreestadia_tarifa_hora_clp";

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Genera la cotización en PDF en el navegador y dispara la descarga.
 * El template y el renderer se importan dinámicamente para no cargarlos
 * hasta que el usuario realmente pide el documento.
 */
export async function descargarCotizacionPDF(id: string): Promise<string> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(SELECT_COTIZACION)
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const cot = data as unknown as {
    contacto_id: string | null;
    contacto_nombre: string | null;
    fecha_despacho: string | null;
  };

  type ContactoRow = {
    empresa: string | null;
    rut: string | null;
    telefono: string | null;
    email: string | null;
  };
  let contacto: ContactoRow | null = null;

  if (cot.contacto_id) {
    const { data: ct } = await supabase
      .from("contactos")
      .select("empresa, rut, telefono, email")
      .eq("id", cot.contacto_id)
      .maybeSingle();
    if (ct) contacto = ct as ContactoRow;
  }

  const [{ pdf }, { CotizacionPDF }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/pdf/CotizacionPDF"),
  ]);

  const blob = await pdf(
    <CotizacionPDF cotizacion={data as never} contacto={contacto} />,
  ).toBlob();

  const nombre = slug(cot.contacto_nombre ?? "Cliente");
  const fecha = (cot.fecha_despacho ?? new Date().toISOString()).slice(0, 10);
  const fileName = `Cotizacion-${nombre}-${fecha}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return fileName;
}
