import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SITE_URL =
  process.env.SITE_URL ||
  process.env.PUBLIC_SITE_URL ||
  "https://tnchile-proveedores.lovable.app";

const BRAND = "#2D7A45";

function emailHtml(nombre: string, link: string, proveedor: string | null) {
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const de = proveedor ? ` de <strong>${proveedor}</strong>` : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:560px;margin:0 auto;background:#fff">
    <div style="background:${BRAND};padding:24px;text-align:center;color:#fff">
      <h1 style="margin:0;font-size:22px">TN Chile · Portal Choferes</h1>
      <p style="margin:6px 0 0;font-size:13px;opacity:.9">La logística la hacemos juntos.</p>
    </div>
    <div style="padding:28px">
      <p style="font-size:16px;margin:0 0 12px">${saludo}</p>
      <p style="margin:0 0 16px;line-height:1.5">Tu empresa${de} te ha invitado a activar tu cuenta como <strong>chofer</strong> en el portal de TN Chile.
      Con tu cuenta podrás ver tus asignaciones, marcar disponibilidad y registrar tus viajes.</p>
      <p style="text-align:center;margin:28px 0">
        <a href="${link}" style="background:${BRAND};color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Activar mi cuenta</a>
      </p>
      <p style="font-size:13px;color:#555;line-height:1.5">O copia este enlace en tu navegador:<br><span style="word-break:break-all;color:#333">${link}</span></p>
      <p style="font-size:12px;color:#888;margin-top:24px">Este enlace expira en 7 días. Si no reconoces esta invitación, puedes ignorar este correo.</p>
    </div>
    <div style="background:#f0f0f0;padding:14px;text-align:center;font-size:12px;color:#666">© TN Chile</div>
  </div></body></html>`;
}

async function sendResend(to: string, subject: string, html: string) {
  const key = process.env.Resend_API_Key;
  if (!key) throw new Error("Resend_API_Key no configurada.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: "TN Chile <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend error ${res.status}: ${t}`);
  }
}

export const inviteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ driver_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Load driver (RLS lets owner see; admins also allowed)
    const { data: driver, error: dErr } = await supabase
      .from("drivers")
      .select("id,user_id,nombre_completo,email,rut")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!driver) throw new Error("Chofer no encontrado.");
    if (!driver.email) throw new Error("El chofer no tiene correo registrado. Edítalo y agrega un email.");

    // Insert invitation (RLS enforces owner-or-admin)
    const { data: inv, error: iErr } = await supabase
      .from("driver_invitations")
      .insert({ driver_id: driver.id, invited_by: userId })
      .select("token")
      .single();
    if (iErr) throw new Error(iErr.message);

    // Proveedor name (best effort)
    let proveedor: string | null = null;
    const { data: prof } = await supabase
      .from("profiles")
      .select("razon_social")
      .eq("id", driver.user_id)
      .maybeSingle();
    proveedor = prof?.razon_social ?? null;

    const link = `${SITE_URL}/invitacion-chofer/${inv.token}`;
    await sendResend(
      driver.email,
      "Activa tu cuenta de chofer · TN Chile",
      emailHtml(driver.nombre_completo ?? "", link, proveedor),
    );

    return { ok: true, email: driver.email };
  });
