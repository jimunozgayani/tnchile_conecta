import type { Correo } from "./templates.server";

export const FROM = "TN Chile Conecta <noreply@tnchile.com>";
export const REPLY_TO = "Juan Ignacio Muñoz <juan.munoz@tnchile.com>";

/** Envía un correo por Resend. Devuelve el id del envío. */
export async function enviarCorreo(to: string, correo: Correo): Promise<string> {
  const key = process.env["Resend_API_Key"];
  if (!key) throw new Error("Resend_API_Key no configurada.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: FROM,
      reply_to: REPLY_TO,
      to: [to],
      subject: correo.subject,
      html: correo.html,
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${body}`);
  try {
    return (JSON.parse(body) as { id?: string }).id ?? "";
  } catch {
    return "";
  }
}

/** Envío best-effort: nunca interrumpe el flujo de negocio. */
export async function enviarCorreoSeguro(to: string | null | undefined, correo: Correo) {
  if (!to) return { ok: false as const, error: "sin destinatario" };
  try {
    const id = await enviarCorreo(to, correo);
    return { ok: true as const, id };
  } catch (e) {
    console.error("email send failed", e instanceof Error ? e.message : e);
    return { ok: false as const, error: e instanceof Error ? e.message : "error de envío" };
  }
}
