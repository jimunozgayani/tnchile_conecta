/**
 * Plantillas de correo de TN Chile Conecta (HTML inline, compatible con Gmail/Outlook).
 * El logo se sirve desde el sitio público para que no quede como ruta relativa.
 */

export const SITE_URL = "https://conecta.tnchile.com";
export const LOGO_URL = `${SITE_URL}/tn-chile-logo.png`;

const VERDE = "#2D7A45";
const VERDE_OSCURO = "#1F5A32";

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fecha = (iso: string | null | undefined) => {
  if (!iso) return "sin fecha";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
};

function boton(url: string, texto: string) {
  return `<p style="margin:28px 0;text-align:center">
    <a href="${esc(url)}" style="background:${VERDE};color:#ffffff;padding:13px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">${esc(texto)}</a>
  </p>`;
}

/** Envoltorio común: header con logo + tagline, cuerpo y footer. */
export function layout(contenidoHtml: string) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f4;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e8e4">
        <tr><td align="center" style="padding:28px 24px 18px;border-bottom:3px solid ${VERDE}">
          <img src="${LOGO_URL}" alt="TN Chile" width="150" style="width:150px;max-width:150px;height:auto;display:block;border:0" />
          <p style="margin:12px 0 0;font-style:italic;font-size:14px;color:${VERDE_OSCURO}">La logística la hacemos juntos.</p>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;font-size:15px;line-height:1.6">${contenidoHtml}</td></tr>
        <tr><td style="padding:20px 28px 26px;border-top:1px solid #eef1ee;font-size:12px;color:#77807a;text-align:center">
          TN Chile Conecta ·
          <a href="${SITE_URL}" style="color:${VERDE};text-decoration:none">conecta.tnchile.com</a><br />
          Si tienes dudas, responde este correo y te contactamos.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export type Correo = { subject: string; html: string };

/** 1. Bienvenida proveedor */
export function bienvenidaProveedor(p: {
  nombre_contacto: string | null;
  razon_social: string | null;
}): Correo {
  const nombre = p.nombre_contacto?.trim() || p.razon_social?.trim() || "proveedor";
  const empresa = p.razon_social?.trim();
  return {
    subject: `Bienvenido a TN Chile Conecta, ${nombre}`,
    html: layout(`
      <h1 style="margin:0 0 14px;font-size:21px;color:${VERDE_OSCURO}">Bienvenido a TN Chile Conecta, ${esc(nombre)}</h1>
      <p style="margin:0 0 14px">Tu cuenta de proveedor${empresa ? ` para <strong>${esc(empresa)}</strong>` : ""} ya está activa.</p>
      <p style="margin:0 0 14px">Desde tu portal puedes:</p>
      <ul style="margin:0 0 14px;padding-left:20px">
        <li>Cargar y mantener al día tus documentos y pólizas.</li>
        <li>Registrar tu flota, tus choferes y su disponibilidad.</li>
        <li>Definir tus tarifas por región y recibir asignaciones de carga.</li>
      </ul>
      ${boton(`${SITE_URL}/perfil`, "Completar mi perfil")}
      <p style="margin:0;font-size:13px;color:#666">Mientras más completo esté tu perfil, más oportunidades de carga podemos asignarte.</p>
    `),
  };
}

/** 2. Bienvenida chofer */
export function bienvenidaChofer(p: {
  nombre_completo: string | null;
  proveedor: string | null;
}): Correo {
  const nombre = p.nombre_completo?.trim() || "chofer";
  return {
    subject: `Ya eres parte de TN Chile Conecta, ${nombre}`,
    html: layout(`
      <h1 style="margin:0 0 14px;font-size:21px;color:${VERDE_OSCURO}">Ya eres parte de TN Chile Conecta, ${esc(nombre)}</h1>
      <p style="margin:0 0 14px">Tu cuenta de chofer quedó activada${p.proveedor ? ` con <strong>${esc(p.proveedor)}</strong>` : ""}.</p>
      <p style="margin:0 0 14px">Con tu cuenta puedes ver tus asignaciones de viaje, marcar tu disponibilidad diaria y registrar la carga y descarga con fotos.</p>
      ${boton(`${SITE_URL}/mis-viajes`, "Ver mis viajes")}
      <p style="margin:0;font-size:13px;color:#666">Mantén tu disponibilidad actualizada: así operaciones te considera primero para nuevas cargas.</p>
    `),
  };
}

/** 3. Alerta de vencimiento de documento */
export function alertaVencimiento(p: {
  nombre: string | null;
  proveedor: string | null;
  doc_tipo: string;
  entity_name: string | null;
  fecha_vencimiento: string;
  dias_restantes: number;
}): Correo {
  const nombre = p.nombre?.trim() || p.proveedor?.trim() || "";
  const vencido = p.dias_restantes < 0;
  return {
    subject: `⚠️ Documento por vencer — ${p.proveedor?.trim() || nombre || "TN Chile Conecta"}`,
    html: layout(`
      <h1 style="margin:0 0 14px;font-size:21px;color:#9a3412">⚠️ ${vencido ? "Documento vencido" : "Documento por vencer"}</h1>
      <p style="margin:0 0 14px">${nombre ? `Hola ${esc(nombre)}, ` : ""}revisamos tus documentos y este necesita atención:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;font-size:14px;border:1px solid #eee;border-radius:8px">
        <tr><td style="padding:10px 12px;color:#666">Documento</td><td style="padding:10px 12px"><strong>${esc(p.doc_tipo)}</strong></td></tr>
        ${p.entity_name ? `<tr><td style="padding:10px 12px;color:#666">Corresponde a</td><td style="padding:10px 12px">${esc(p.entity_name)}</td></tr>` : ""}
        <tr><td style="padding:10px 12px;color:#666">Fecha de vencimiento</td><td style="padding:10px 12px"><strong>${fecha(p.fecha_vencimiento)}</strong></td></tr>
        <tr><td style="padding:10px 12px;color:#666">Estado</td><td style="padding:10px 12px">${vencido ? `Vencido hace ${Math.abs(p.dias_restantes)} día(s)` : `Vence en ${p.dias_restantes} día(s)`}</td></tr>
      </table>
      ${boton(`${SITE_URL}/documentos`, "Actualizar documento")}
      <p style="margin:0;font-size:13px;color:#666">Con documentos vencidos no podemos asignarte nuevas cargas.</p>
    `),
  };
}

/** 4. Notificación de mensaje nuevo */
export function notificacionMensaje(p: {
  nombre: string | null;
  remitente: string;
  asunto: string;
  preview: string;
}): Correo {
  const nombre = p.nombre?.trim() || "";
  const preview = p.preview.length > 220 ? `${p.preview.slice(0, 220)}…` : p.preview;
  return {
    subject: `Nuevo mensaje de TN Chile Conecta${nombre ? `, ${nombre}` : ""}`,
    html: layout(`
      <h1 style="margin:0 0 14px;font-size:21px;color:${VERDE_OSCURO}">Tienes un mensaje nuevo</h1>
      <p style="margin:0 0 14px">${nombre ? `Hola ${esc(nombre)}, ` : ""}<strong>${esc(p.remitente)}</strong> te escribió desde TN Chile Conecta.</p>
      <div style="margin:0 0 16px;padding:14px 16px;background:#f4f8f5;border-left:4px solid ${VERDE};border-radius:6px">
        <p style="margin:0 0 6px;font-weight:700">${esc(p.asunto)}</p>
        <p style="margin:0;color:#4a4a4a">${esc(preview)}</p>
      </div>
      ${boton(`${SITE_URL}/mensajes`, "Leer el mensaje")}
    `),
  };
}

/** 5. Confirmación de documento recibido */
export function confirmacionDocumento(p: {
  nombre: string | null;
  doc_tipo: string;
  nombre_archivo: string | null;
  subido_por: string | null;
  vencimiento: string | null;
}): Correo {
  const nombre = p.nombre?.trim() || "";
  return {
    subject: `Documento recibido — ${p.doc_tipo}`,
    html: layout(`
      <h1 style="margin:0 0 14px;font-size:21px;color:${VERDE_OSCURO}">Documento recibido</h1>
      <p style="margin:0 0 14px">${nombre ? `Hola ${esc(nombre)}, ` : ""}registramos correctamente tu documento en TN Chile Conecta.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;font-size:14px;border:1px solid #eee;border-radius:8px">
        <tr><td style="padding:10px 12px;color:#666">Tipo</td><td style="padding:10px 12px"><strong>${esc(p.doc_tipo)}</strong></td></tr>
        ${p.nombre_archivo ? `<tr><td style="padding:10px 12px;color:#666">Archivo</td><td style="padding:10px 12px">${esc(p.nombre_archivo)}</td></tr>` : ""}
        <tr><td style="padding:10px 12px;color:#666">Fecha de recepción</td><td style="padding:10px 12px">${fecha(new Date().toISOString())}</td></tr>
        ${p.subido_por ? `<tr><td style="padding:10px 12px;color:#666">Subido por</td><td style="padding:10px 12px">${esc(p.subido_por)}</td></tr>` : ""}
        ${p.vencimiento ? `<tr><td style="padding:10px 12px;color:#666">Vence</td><td style="padding:10px 12px">${fecha(p.vencimiento)}</td></tr>` : ""}
      </table>
      ${boton(`${SITE_URL}/documentos`, "Ver mis documentos")}
      <p style="margin:0;font-size:13px;color:#666">Nuestro equipo lo revisará y te avisaremos si falta algo.</p>
    `),
  };
}

/** 6. Invitación a proveedor */
export function invitacionProveedor(p: {
  nombre: string | null;
  empresa: string | null;
  link: string;
}): Correo {
  const nombre = p.nombre?.trim() || p.empresa?.trim() || "Hola";
  return {
    subject: `${nombre}, te invitamos a TN Chile Conecta`,
    html: layout(`
      <h1 style="margin:0 0 14px;font-size:21px;color:${VERDE_OSCURO}">${esc(nombre)}, te invitamos a TN Chile Conecta</h1>
      <p style="margin:0 0 14px">Queremos trabajar con ${p.empresa ? `<strong>${esc(p.empresa)}</strong>` : "tu empresa"} en nuestra red de transporte.</p>
      <p style="margin:0 0 14px">Al activar tu cuenta de proveedor podrás:</p>
      <ul style="margin:0 0 14px;padding-left:20px">
        <li>Publicar tu flota, tus choferes y su disponibilidad.</li>
        <li>Cargar documentos y pólizas en un solo lugar.</li>
        <li>Definir tarifas por región y recibir cargas de nuestros clientes.</li>
      </ul>
      ${boton(p.link, "Activar mi cuenta")}
      <p style="margin:0 0 8px;font-size:13px;color:#555">O copia este enlace en tu navegador:<br /><span style="word-break:break-all;color:#333">${esc(p.link)}</span></p>
      <p style="margin:0;font-size:12px;color:#888">Si no esperabas esta invitación, puedes ignorar este correo.</p>
    `),
  };
}

/** Invitación a chofer (enviada por su proveedor). */
export function invitacionChofer(p: {
  nombre: string | null;
  proveedor: string | null;
  link: string;
}): Correo {
  const nombre = p.nombre?.trim() || "Hola";
  return {
    subject: `${nombre}, activa tu cuenta de chofer en TN Chile Conecta`,
    html: layout(`
      <h1 style="margin:0 0 14px;font-size:21px;color:${VERDE_OSCURO}">${esc(nombre)}, activa tu cuenta de chofer</h1>
      <p style="margin:0 0 14px">${p.proveedor ? `<strong>${esc(p.proveedor)}</strong> te invitó` : "Te invitamos"} a TN Chile Conecta. Con tu cuenta ves tus asignaciones, marcas disponibilidad y registras tus viajes.</p>
      ${boton(p.link, "Activar mi cuenta")}
      <p style="margin:0 0 8px;font-size:13px;color:#555">O copia este enlace en tu navegador:<br /><span style="word-break:break-all;color:#333">${esc(p.link)}</span></p>
      <p style="margin:0;font-size:12px;color:#888">Este enlace expira en 7 días.</p>
    `),
  };
}
