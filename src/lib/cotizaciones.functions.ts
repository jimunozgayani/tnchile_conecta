import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TRANSICIONES,
  COMERCIALISH,
  ADMINISH,
  rolesDe,
} from "@/lib/cotizaciones-transiciones";

const cotizacionSchema = z.object({
  contacto_id: z.string().uuid("Selecciona un contacto"),
  origen: z.string().trim().min(1, "Origen requerido").max(300),
  destino: z.string().trim().min(1, "Destino requerido").max(300),
  tipo_camion: z.string().trim().max(120).optional().nullable(),
  fecha_despacho: z.string().trim().max(10).optional().nullable(),
  notas_admin: z.string().trim().max(2000).optional().nullable(),
  contacto_telefono: z.string().trim().max(40).optional().nullable(),
  contacto_email: z.string().trim().max(200).optional().nullable(),
  peso_kg: z.coerce.number().nonnegative().max(1_000_000).optional().nullable(),
});


export type CotizacionInput = z.infer<typeof cotizacionSchema>;

const clean = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : v;
  return s === "" || s === undefined ? null : s;
};

export const createCotizacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cotizacionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: { role: string }) => r.role);
    if (!["admin", "lider_cuenta", "comercial"].some((r) => roles.includes(r))) {
      throw new Error("No tienes permisos para crear cotizaciones.");
    }

    const { data: contacto, error: cErr } = await supabase
      .from("contactos")
      .select("id, nombre, telefono, email")
      .eq("id", data.contacto_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contacto) throw new Error("Contacto no encontrado.");

    const c = contacto as { nombre: string; telefono: string | null; email: string | null };

    const { data: row, error } = await supabase
      .from("cotizaciones")
      .insert({
        contacto_id: data.contacto_id,
        contacto_nombre: c.nombre,
        contacto_telefono: clean(data.contacto_telefono) ?? c.telefono,
        contacto_email: clean(data.contacto_email) ?? c.email,
        origen: data.origen,
        destinos: [data.destino],
        tipo_camion: clean(data.tipo_camion),
        peso_kg: data.peso_kg ?? null,
        fecha_despacho: clean(data.fecha_despacho),
        notas_admin: clean(data.notas_admin),
        modalidad: "completo",
        estado: "nueva",
        asignado_a: userId,
        fotos: [],
      } as never)

      .select("id, estado")
      .single();

    if (error) throw new Error(error.message);
    return row as { id: string; estado: string };
  });

// ─────────────────────────────────────────────────────────────
// Transiciones de estado del pipeline comercial
// ─────────────────────────────────────────────────────────────

const estadoSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum([
    "cotizada",
    "aceptada",
    "en_revision",
    "rechazada",
    "lista_para_operar",
    "cerrada",
  ]),
  comentario: z.string().trim().max(2000).optional().nullable(),
});

export const actualizarEstadoCotizacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => estadoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!COMERCIALISH.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { data: actual, error: rErr } = await supabase
      .from("cotizaciones")
      .select("id, estado, revision_count")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!actual) throw new Error("Cotización no encontrada.");

    const row = actual as { estado: string; revision_count: number | null };
    const permitidas = TRANSICIONES[row.estado] ?? [];
    if (!permitidas.includes(data.estado)) {
      throw new Error(`Transición no permitida: ${row.estado} → ${data.estado}`);
    }

    const comentario = (data.comentario ?? "").trim();
    if ((data.estado === "en_revision" || data.estado === "rechazada") && comentario.length < 10) {
      throw new Error("El comentario es obligatorio (mínimo 10 caracteres).");
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let revisionCount = row.revision_count ?? 0;

    if (data.estado === "en_revision") {
      revisionCount += 1;
      patch["revision_count"] = revisionCount;
      patch["comentarios_revision"] = comentario;
      patch["estado"] = "cotizada";
    } else if (data.estado === "rechazada") {
      patch["comentarios_rechazo"] = comentario;
      patch["rechazada_at"] = new Date().toISOString();
      patch["estado"] = "rechazada";
    } else {
      patch["estado"] = data.estado;
    }

    const { error } = await supabase
      .from("cotizaciones")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: aErr } = await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "cotizaciones",
      registro_id: data.id,
      accion: `estado_${data.estado}`,
      datos_nuevos: {
        estado: data.estado,
        comentario: comentario || null,
        revision_count: revisionCount,
      },
      usuario_id: userId,
    } as never);
    if (aErr) console.error("audit_log insert failed", aErr.message);

    return { ok: true, estado: patch["estado"] as string, revision_count: revisionCount };
  });

export const asignarCotizacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), asignado_a: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!ADMINISH.some((r) => roles.includes(r))) throw new Error("Solo admin o líder de cuenta.");

    const { error } = await supabase
      .from("cotizaciones")
      .update({ asignado_a: data.asignado_a, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "cotizaciones",
      registro_id: data.id,
      accion: "asignacion",
      datos_nuevos: { asignado_a: data.asignado_a },
      usuario_id: userId,
    } as never);

    return { ok: true };
  });

export type Asignable = { id: string; nombre: string };

/** Usuarios asignables (comercial / líder de cuenta) para el selector. */
export const obtenerAsignables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Asignable[]> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!COMERCIALISH.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .in("role", ["comercial", "lider_cuenta"]);
    const ids = [...new Set(((roleRows ?? []) as { user_id: string }[]).map((r) => r.user_id))];
    if (ids.length === 0) return [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, nombre_contacto, razon_social, correo")
      .in("id", ids);
    const byId = new Map(
      ((profiles ?? []) as {
        id: string;
        nombre_contacto: string | null;
        razon_social: string | null;
        correo: string | null;
      }[]).map((p) => [p.id, p.nombre_contacto || p.razon_social || p.correo || ""]),
    );

    const out: Asignable[] = [];
    for (const id of ids) {
      let nombre = byId.get(id) ?? "";
      if (!nombre) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        nombre = u?.user?.email ?? id.slice(0, 8);
      }
      out.push({ id, nombre });
    }
    return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
