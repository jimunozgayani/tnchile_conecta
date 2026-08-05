import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const cotizacionSchema = z.object({
  contacto_id: z.string().uuid("Selecciona un contacto"),
  origen: z.string().trim().min(1, "Origen requerido").max(300),
  destino: z.string().trim().min(1, "Destino requerido").max(300),
  tipo_camion: z.string().trim().max(120).optional().nullable(),
  fecha_despacho: z.string().trim().max(10).optional().nullable(),
  notas_admin: z.string().trim().max(2000).optional().nullable(),
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
        contacto_telefono: c.telefono,
        contacto_email: c.email,
        origen: data.origen,
        destinos: [data.destino],
        tipo_camion: clean(data.tipo_camion),
        fecha_despacho: clean(data.fecha_despacho),
        notas_admin: clean(data.notas_admin),
        modalidad: "completo",
        estado: "nueva",
        fotos: [],
      } as never)
      .select("id, estado")
      .single();

    if (error) throw new Error(error.message);
    return row as { id: string; estado: string };
  });
