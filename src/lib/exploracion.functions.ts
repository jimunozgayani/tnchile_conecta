import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { rolesDe } from "@/lib/cotizaciones-transiciones";

const OPS_ABRIR = ["admin", "jefe_operaciones"];
const OPS_PROPONER = ["admin", "jefe_operaciones", "operador"];
const OPS_GANADORA = ["admin", "jefe_operaciones"];

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
  estado: string;
  creado_at: string;
};

/** Abre la exploración de proveedores para una cotización en estado 'nueva'. */
export const abrirExploracion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cotizacion_id: z.string().uuid() }).parse(d))
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

    const { error } = await supabase
      .from("cotizaciones")
      .update({
        estado: "en_exploracion",
        exploracion_abierta_at: new Date().toISOString(),
        exploracion_abierta_por: userId,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.cotizacion_id);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "cotizaciones",
      registro_id: data.cotizacion_id,
      accion: "exploracion_abierta",
      datos_nuevos: { estado: "en_exploracion" },
      usuario_id: userId,
    } as never);

    return { ok: true, estado: "en_exploracion" };
  });

const propuestaSchema = z.object({
  cotizacion_id: z.string().uuid(),
  proveedor_nombre: z.string().trim().min(1, "Nombre del proveedor requerido").max(200),
  proveedor_contacto_id: z.string().uuid().optional().nullable(),
  costo_clp: z.coerce.number().positive("El costo debe ser mayor a 0").max(999_999_999),
  tipo_camion_id: z.string().uuid().optional().nullable(),
  notas: z.string().trim().max(2000).optional().nullable(),
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
      .select("id, estado")
      .eq("id", data.cotizacion_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);
    if (!cot) throw new Error("Cotización no encontrada.");
    if ((cot as { estado: string }).estado !== "en_exploracion") {
      throw new Error("La exploración de esta carga no está abierta.");
    }

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
        estado: "propuesta",
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
      },
      usuario_id: userId,
    } as never);

    return { ok: true, id: (row as { id: string }).id };
  });

/** Marca una propuesta como ganadora, descarta el resto y fija el costo. */
export const elegirGanadora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propuesta_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await rolesDe(supabase as never, userId);
    if (!OPS_GANADORA.some((r) => roles.includes(r))) {
      throw new Error("Solo admin o jefe de operaciones puede elegir la ganadora.");
    }

    const { data: prop, error: pErr } = await supabase
      .from("propuestas_proveedor")
      .select("id, cotizacion_id, costo_clp, proveedor_nombre")
      .eq("id", data.propuesta_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Propuesta no encontrada.");
    const p = prop as { id: string; cotizacion_id: string; costo_clp: number; proveedor_nombre: string };

    const { error: gErr } = await supabase
      .from("propuestas_proveedor")
      .update({ estado: "ganadora", actualizado_at: new Date().toISOString() } as never)
      .eq("id", p.id);
    if (gErr) throw new Error(gErr.message);

    const { error: dErr } = await supabase
      .from("propuestas_proveedor")
      .update({ estado: "descartada", actualizado_at: new Date().toISOString() } as never)
      .eq("cotizacion_id", p.cotizacion_id)
      .neq("id", p.id);
    if (dErr) throw new Error(dErr.message);

    const { error: cErr } = await supabase
      .from("cotizaciones")
      .update({
        costo_proveedor_fijado_clp: p.costo_clp,
        propuesta_ganadora_id: p.id,
        estado: "costo_fijado",
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", p.cotizacion_id);
    if (cErr) throw new Error(cErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_log").insert({
      tabla_nombre: "propuestas_proveedor",
      registro_id: p.id,
      accion: "ganadora_elegida",
      datos_nuevos: {
        cotizacion_id: p.cotizacion_id,
        proveedor_nombre: p.proveedor_nombre,
        costo_clp: p.costo_clp,
      },
      usuario_id: userId,
    } as never);

    return { ok: true, cotizacion_id: p.cotizacion_id, costo_clp: p.costo_clp };
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
        "id, cotizacion_id, operador_id, proveedor_nombre, proveedor_contacto_id, costo_clp, tipo_camion_id, notas, estado, creado_at",
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
