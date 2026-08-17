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
  largo_cm: z.coerce.number().nonnegative().max(100_000).optional().nullable(),
  ancho_cm: z.coerce.number().nonnegative().max(100_000).optional().nullable(),
  alto_cm: z.coerce.number().nonnegative().max(100_000).optional().nullable(),
  fotos: z.array(z.string().trim().max(500)).max(5).optional(),
  carga_hora_desde: z.string().trim().max(8).optional().nullable(),
  carga_hora_hasta: z.string().trim().max(8).optional().nullable(),
  descarga_fecha: z.string().trim().max(10).optional().nullable(),
  descarga_hora_desde: z.string().trim().max(8).optional().nullable(),
  descarga_hora_hasta: z.string().trim().max(8).optional().nullable(),
  descarga_notas: z.string().trim().max(2000).optional().nullable(),

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
        largo_cm: data.largo_cm ?? null,
        ancho_cm: data.ancho_cm ?? null,
        alto_cm: data.alto_cm ?? null,
        fecha_despacho: clean(data.fecha_despacho),
        notas_admin: clean(data.notas_admin),
        modalidad: "completo",
        estado: "nueva",
        asignado_a: userId,
        fotos: data.fotos ?? [],
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
      // Vuelve al inicio del flujo para poder re-explorar desde cero.
      patch["estado"] = "nueva";
      patch["exploracion_abierta_at"] = null;
      patch["exploracion_abierta_por"] = null;
      patch["exploracion_limite_at"] = null;
      patch["costo_proveedor_fijado_clp"] = null;
      patch["propuesta_ganadora_id"] = null;
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
      accion: data.estado === "en_revision" ? "revision_vuelve_a_nueva" : `estado_${data.estado}`,
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

// ─────────────────────────────────────────────────────────────
// Edición de campos de la ficha de cotización
// ─────────────────────────────────────────────────────────────

const patchSchema = z.object({
  id: z.string().uuid(),
  notas_admin: z.string().trim().max(4000).optional().nullable(),
});

/** Actualiza las notas internas de una cotización (admin, lider_cuenta, comercial). */
export const actualizarCotizacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!COMERCIALISH.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const notas = (data.notas_admin ?? "").trim();
    const { error } = await supabase
      .from("cotizaciones")
      .update({ notas_admin: notas || null, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, notas_admin: notas || null };
  });

// ─────────────────────────────────────────────────────────────
// Edición completa (admin / lider_cuenta) — cualquier estado
// ─────────────────────────────────────────────────────────────

const completoSchema = z.object({
  id: z.string().uuid(),
  contacto_id: z.string().uuid().optional().nullable(),
  origen: z.string().trim().max(300).optional().nullable(),
  destino: z.string().trim().max(300).optional().nullable(),
  tipo_camion_id: z.string().uuid().optional().nullable(),
  tipo_camion_otro: z.string().trim().max(120).optional().nullable(),
  peso_kg: z.coerce.number().nonnegative().max(1_000_000).optional().nullable(),
  largo_cm: z.coerce.number().nonnegative().max(100_000).optional().nullable(),
  ancho_cm: z.coerce.number().nonnegative().max(100_000).optional().nullable(),
  alto_cm: z.coerce.number().nonnegative().max(100_000).optional().nullable(),
  fecha_despacho: z.string().trim().max(10).optional().nullable(),
  notas_admin: z.string().trim().max(4000).optional().nullable(),
  precio_ofrecido_cliente_clp: z.coerce.number().nonnegative().max(1_000_000_000).optional().nullable(),
  tipo_pago: z.enum(["contado", "50_50", "15_dias", "30_dias"]).optional().nullable(),
  validez_hasta: z.string().trim().max(10).optional().nullable(),
  presupuesto_referencial_cliente_clp: z.coerce
    .number()
    .nonnegative()
    .max(1_000_000_000)
    .optional()
    .nullable(),
  fotos: z.array(z.string().trim().max(500)).max(20).optional(),
  carga_hora_desde: z.string().trim().max(8).optional().nullable(),
  carga_hora_hasta: z.string().trim().max(8).optional().nullable(),
  descarga_fecha: z.string().trim().max(10).optional().nullable(),
  descarga_hora_desde: z.string().trim().max(8).optional().nullable(),
  descarga_hora_hasta: z.string().trim().max(8).optional().nullable(),
  descarga_notas: z.string().trim().max(2000).optional().nullable(),
});

const ESTADOS_CON_PRECIO = [
  "cotizada",
  "aceptada",
  "lista_para_operar",
  "confirmada",
  "en_operacion",
  "finalizada",
  "cobro_pendiente",
  "cerrada",
  "rechazada",
];

/** Estados en que un comercial puede corregir los datos de la carga de su propia cotización. */
export const ESTADOS_EDITABLES_COMERCIAL = ["nueva", "pendiente", "cotizada"];

/**
 * Edición de la ficha.
 * - admin / lider_cuenta: todos los campos, en cualquier estado.
 * - comercial: solo datos de la carga + presupuesto referencial, en sus propias
 *   cotizaciones y mientras estén en 'nueva' o 'cotizada'.
 */
export const actualizarCotizacionCompleta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => completoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    const esAdmin = ADMINISH.some((r) => roles.includes(r));
    const esComercial = roles.includes("comercial");
    if (!esAdmin && !esComercial) {
      throw new Error("No tienes permisos para editar la cotización.");
    }

    const { data: actual, error: rErr } = await supabase
      .from("cotizaciones")
      .select("id, estado, destinos, asignado_a, fecha_despacho")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!actual) throw new Error("Cotización no encontrada.");
    const row = actual as {
      estado: string;
      destinos: unknown;
      asignado_a: string | null;
      fecha_despacho: string | null;
    };

    if (!esAdmin) {
      if (row.asignado_a !== userId) {
        throw new Error("Solo puedes editar cotizaciones asignadas a ti.");
      }
      if (!ESTADOS_EDITABLES_COMERCIAL.includes(row.estado)) {
        throw new Error(
          "Los datos de la carga solo pueden editarse mientras la cotización está en 'Nueva' o 'Cotizada'.",
        );
      }
      if (
        data.contacto_id !== undefined ||
        data.precio_ofrecido_cliente_clp !== undefined ||
        data.tipo_pago !== undefined ||
        data.validez_hasta !== undefined
      ) {
        throw new Error("Esos campos solo puede editarlos administración o el líder de cuenta.");
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (data.contacto_id !== undefined && data.contacto_id !== null) {
      const { data: c, error: cErr } = await supabase
        .from("contactos")
        .select("id, nombre, telefono, email")
        .eq("id", data.contacto_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      if (!c) throw new Error("Contacto no encontrado.");
      const ct = c as { nombre: string; telefono: string | null; email: string | null };
      patch["contacto_id"] = data.contacto_id;
      patch["contacto_nombre"] = ct.nombre;
      patch["contacto_telefono"] = ct.telefono;
      patch["contacto_email"] = ct.email;
    }

    if (data.origen !== undefined) patch["origen"] = clean(data.origen);
    if (data.destino !== undefined) {
      const resto = Array.isArray(row.destinos) ? (row.destinos as unknown[]).slice(1) : [];
      const d = clean(data.destino);
      patch["destinos"] = d ? [d, ...resto] : resto;
    }

    if (data.tipo_camion_id !== undefined) {
      patch["tipo_camion_id"] = data.tipo_camion_id ?? null;
      if (data.tipo_camion_id) {
        const { data: t } = await supabase
          .from("tipos_camion")
          .select("nombre")
          .eq("id", data.tipo_camion_id)
          .maybeSingle();
        patch["tipo_camion"] = (t as { nombre: string } | null)?.nombre ?? null;
      } else if (data.tipo_camion_otro === undefined) {
        patch["tipo_camion"] = null;
      }
    }
    if (data.tipo_camion_otro !== undefined) {
      const otro = clean(data.tipo_camion_otro);
      patch["tipo_camion_otro"] = otro;
      if (otro && !data.tipo_camion_id) patch["tipo_camion"] = otro;
    }

    for (const k of ["peso_kg", "largo_cm", "ancho_cm", "alto_cm"] as const) {
      if (data[k] !== undefined) patch[k] = data[k] ?? null;
    }
    if (data.fecha_despacho !== undefined) patch["fecha_despacho"] = clean(data.fecha_despacho);
    if (data.presupuesto_referencial_cliente_clp !== undefined)
      patch["presupuesto_referencial_cliente_clp"] = data.presupuesto_referencial_cliente_clp ?? null;
    if (data.notas_admin !== undefined) patch["notas_admin"] = clean(data.notas_admin);
    if (data.fotos !== undefined) patch["fotos"] = data.fotos;

    // Ventanas horarias de carga y descarga.
    for (const k of [
      "carga_hora_desde",
      "carga_hora_hasta",
      "descarga_fecha",
      "descarga_hora_desde",
      "descarga_hora_hasta",
      "descarga_notas",
    ] as const) {
      if (data[k] !== undefined) patch[k] = clean(data[k]);
    }

    // Única validación: la descarga no puede ser ANTES de la carga (mismo día o
    // días posteriores son válidos).
    const fechaCargaFinal =
      (patch["fecha_despacho"] as string | null | undefined) ??
      row.fecha_despacho;
    const fechaDescargaFinal = patch["descarga_fecha"] as string | null | undefined;
    if (fechaCargaFinal && fechaDescargaFinal && fechaDescargaFinal < fechaCargaFinal) {
      throw new Error("La fecha de descarga no puede ser anterior a la fecha de carga.");
    }

    const precioEditable = ESTADOS_CON_PRECIO.includes(row.estado);
    const pidePrecio =
      data.precio_ofrecido_cliente_clp !== undefined ||
      data.tipo_pago !== undefined ||
      data.validez_hasta !== undefined;
    if (pidePrecio) {
      if (!precioEditable) {
        throw new Error("El precio solo puede editarse desde el estado 'cotizada' en adelante.");
      }
      if (data.precio_ofrecido_cliente_clp !== undefined)
        patch["precio_ofrecido_cliente_clp"] = data.precio_ofrecido_cliente_clp ?? null;
      if (data.tipo_pago !== undefined) patch["tipo_pago"] = data.tipo_pago ?? null;
      if (data.validez_hasta !== undefined) patch["validez_hasta"] = clean(data.validez_hasta);
    }

    const { error } = await supabase
      .from("cotizaciones")
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { updated_at: _omit, ...campos } = patch;
    const { error: aErr } = await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "cotizaciones",
      registro_id: data.id,
      accion: "edicion_completa",
      datos_nuevos: { estado_al_editar: row.estado, campos },
      usuario_id: userId,
    } as never);
    if (aErr) console.error("audit_log insert failed", aErr.message);

    return { ok: true, campos: Object.keys(campos) };
  });
