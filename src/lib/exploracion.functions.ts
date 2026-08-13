import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";

const OPS_ABRIR = ["admin", "jefe_operaciones"];
const OPS_PROPONER = ["admin", "jefe_operaciones", "operador", "lider_cuenta"];
const OPS_GANADORA = ["admin", "lider_cuenta"];

export type Propuesta = {
  id: string;
  cotizacion_id: string;
  operador_id: string;
  operador_nombre: string;
  proveedor_nombre: string;
  proveedor_contacto_id: string | null;
  costo_clp: number;
  tipo_camion_id: string | null;
  notas: string | null;
  tipo_pago: string | null;
  estado: string;
  creado_at: string;
  ronda: number;
};

/** Abre la exploración de proveedores para una cotización en estado 'nueva'. */
export const abrirExploracion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cotizacion_id: z.string().uuid(),
        duracion_horas: z.coerce.number().positive().max(72).default(3),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_ABRIR.some((r) => roles.includes(r))) {
      throw new Error("Solo admin o jefe de operaciones puede abrir la exploración.");
    }

    const { data: cot, error: rErr } = await supabase
      .from("cotizaciones")
      .select("id, estado")
      .eq("id", data.cotizacion_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!cot) throw new Error("Cotización no encontrada.");
    if ((cot as { estado: string }).estado !== "nueva") {
      throw new Error("La exploración solo se abre desde el estado 'nueva'.");
    }

    const ahora = new Date();
    const limite = new Date(ahora.getTime() + data.duracion_horas * 3_600_000);

    const { error } = await supabase
      .from("cotizaciones")
      .update({
        estado: "en_exploracion",
        exploracion_abierta_at: ahora.toISOString(),
        exploracion_abierta_por: userId,
        exploracion_limite_at: limite.toISOString(),
        updated_at: ahora.toISOString(),
      } as never)
      .eq("id", data.cotizacion_id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "cotizaciones",
      registro_id: data.cotizacion_id,
      accion: "exploracion_abierta",
      datos_nuevos: {
        estado: "en_exploracion",
        duracion_horas: data.duracion_horas,
        exploracion_limite_at: limite.toISOString(),
      },
      usuario_id: userId,
    } as never);

    return {
      ok: true,
      estado: "en_exploracion",
      exploracion_limite_at: limite.toISOString(),
    };
  });

const propuestaSchema = z.object({
  cotizacion_id: z.string().uuid(),
  proveedor_nombre: z.string().trim().min(1, "Nombre del proveedor requerido").max(200),
  proveedor_contacto_id: z.string().uuid().optional().nullable(),
  costo_clp: z.coerce.number().positive("El costo debe ser mayor a 0").max(999_999_999),
  tipo_camion_id: z.string().uuid().optional().nullable(),
  notas: z.string().trim().max(2000).optional().nullable(),
  tipo_pago: z.enum(["contado", "50_50", "15_dias", "30_dias"]).optional().nullable(),
});

/** Registra una propuesta de proveedor (nombre libre, contacto opcional). */
export const agregarPropuesta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => propuestaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_PROPONER.some((r) => roles.includes(r))) throw new Error("Sin permisos.");

    const { data: cot, error: rErr } = await supabase
      .from("cotizaciones")
      .select("id, estado, revision_count")
      .eq("id", data.cotizacion_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!cot) throw new Error("Cotización no encontrada.");
    if ((cot as { estado: string }).estado !== "en_exploracion") {
      throw new Error("La exploración de esta carga no está abierta.");
    }

    // La ronda de exploración se deriva de revision_count: cada vez que la
    // cotización vuelve a 'nueva' por revisión, empieza una ronda nueva.
    const ronda = ((cot as { revision_count: number | null }).revision_count ?? 0) + 1;

    const { data: row, error } = await supabase
      .from("propuestas_proveedor")
      .insert({
        cotizacion_id: data.cotizacion_id,
        operador_id: userId,
        proveedor_nombre: data.proveedor_nombre,
        proveedor_contacto_id: data.proveedor_contacto_id || null,
        costo_clp: data.costo_clp,
        tipo_camion_id: data.tipo_camion_id || null,
        notas: (data.notas ?? "").trim() || null,
        tipo_pago: data.tipo_pago || null,
        estado: "propuesta",
        ronda,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "propuestas_proveedor",
      registro_id: (row as { id: string }).id,
      accion: "propuesta_agregada",
      datos_nuevos: {
        cotizacion_id: data.cotizacion_id,
        proveedor_nombre: data.proveedor_nombre,
        costo_clp: data.costo_clp,
        ronda,
      },
      usuario_id: userId,
    } as never);

    return { ok: true, id: (row as { id: string }).id };
  });

/** Elige la propuesta ganadora, fija el costo del proveedor y el precio al cliente. */
export const elegirGanadoraYFijarPrecio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        propuesta_id: z.string().uuid(),
        precio_ofrecido_cliente_clp: z.coerce.number().positive().max(999_999_999),
        tipo_pago: z.enum(["contado", "50_50", "15_dias", "30_dias"]).optional().nullable(),
        validez_hasta: z.string().trim().min(1).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_GANADORA.some((r) => roles.includes(r))) {
      throw new Error("Solo admin o líder de cuenta puede elegir la ganadora y cotizar.");
    }

    const { data: prop, error: pErr } = await supabase
      .from("propuestas_proveedor")
      .select("id, cotizacion_id, costo_clp, proveedor_nombre")
      .eq("id", data.propuesta_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Propuesta no encontrada.");
    const p = prop as { id: string; cotizacion_id: string; costo_clp: number; proveedor_nombre: string };

    // Una sola transacción atómica en la base de datos (incluye el audit_log).
    const { error: rpcErr } = await supabase.rpc("elegir_ganadora_y_fijar_precio", {
      p_propuesta_id: p.id,
      p_precio_ofrecido_cliente_clp: data.precio_ofrecido_cliente_clp,
      p_tipo_pago: data.tipo_pago ?? null,
      p_validez_hasta: data.validez_hasta ?? null,
    } as never);
    if (rpcErr) throw new Error(rpcErr.message);

    return {
      ok: true,
      cotizacion_id: p.cotizacion_id,
      costo_clp: p.costo_clp,
      precio_ofrecido_cliente_clp: data.precio_ofrecido_cliente_clp,
    };
  });

/** Propuestas visibles para el usuario, con el nombre del operador que propuso. */
export const listarPropuestas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ cotizacion_ids: z.array(z.string().uuid()).max(200) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<Propuesta[]> => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_PROPONER.some((r) => roles.includes(r))) throw new Error("Sin permisos.");
    if (data.cotizacion_ids.length === 0) return [];

    const { data: rows, error } = await supabase
      .from("propuestas_proveedor")
      .select(
        "id, cotizacion_id, operador_id, proveedor_nombre, proveedor_contacto_id, costo_clp, tipo_camion_id, notas, tipo_pago, estado, creado_at, ronda",
      )
      .in("cotizacion_id", data.cotizacion_ids)
      .order("costo_clp", { ascending: true });
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as Omit<Propuesta, "operador_nombre">[];
    const opIds = [...new Set(list.map((r) => r.operador_id))];
    const nombres = new Map<string, string>();

    if (opIds.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, nombre_contacto, razon_social, correo")
        .in("id", opIds);
      for (const pr of (profiles ?? []) as {
        id: string;
        nombre_contacto: string | null;
        razon_social: string | null;
        correo: string | null;
      }[]) {
        const n = pr.nombre_contacto || pr.razon_social || pr.correo;
        if (n) nombres.set(pr.id, n);
      }
      for (const id of opIds) {
        if (!nombres.get(id)) {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          nombres.set(id, u?.user?.email ?? id.slice(0, 8));
        }
      }
    }

    return list.map((r) => ({ ...r, operador_nombre: nombres.get(r.operador_id) ?? "—" }));
  });

/**
 * Resuelve una exploración cerrada automáticamente por vencimiento de plazo:
 * reabrirla con un nuevo plazo, devolverla a 'nueva' o rechazar la cotización.
 */
export const resolverExploracionVencida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        cotizacion_id: z.string().uuid(),
        accion: z.enum(["reabrir", "volver_nueva", "rechazar"]),
        duracion_horas: z.coerce.number().positive().max(72).default(3),
        comentarios: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_GANADORA.some((r) => roles.includes(r))) {
      throw new Error("Solo admin o líder de cuenta puede resolver una exploración vencida.");
    }

    const { data: cot, error: rErr } = await supabase
      .from("cotizaciones")
      .select("id, estado")
      .eq("id", data.cotizacion_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!cot) throw new Error("Cotización no encontrada.");
    if ((cot as { estado: string }).estado !== "exploracion_vencida") {
      throw new Error("Esta carga no está en estado 'exploración vencida'.");
    }

    const ahora = new Date();
    let patch: Record<string, unknown>;
    let estado: string;

    if (data.accion === "reabrir") {
      const limite = new Date(ahora.getTime() + data.duracion_horas * 3_600_000);
      estado = "en_exploracion";
      patch = {
        estado,
        exploracion_abierta_at: ahora.toISOString(),
        exploracion_abierta_por: userId,
        exploracion_limite_at: limite.toISOString(),
      };
    } else if (data.accion === "volver_nueva") {
      estado = "nueva";
      patch = {
        estado,
        exploracion_abierta_at: null,
        exploracion_abierta_por: null,
        exploracion_limite_at: null,
      };
    } else {
      estado = "rechazada";
      patch = {
        estado,
        comentarios_rechazo: (data.comentarios ?? "").trim() || null,
        rechazada_at: ahora.toISOString(),
      };
    }

    const { error } = await supabase
      .from("cotizaciones")
      .update({ ...patch, updated_at: ahora.toISOString() } as never)
      .eq("id", data.cotizacion_id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "cotizaciones",
      registro_id: data.cotizacion_id,
      accion: "exploracion_vencida_resuelta",
      datos_nuevos: { accion: data.accion, estado, ...patch },
      usuario_id: userId,
    } as never);

    return { ok: true, estado };
  });
